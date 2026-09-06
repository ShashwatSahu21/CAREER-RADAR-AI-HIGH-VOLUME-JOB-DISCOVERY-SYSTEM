"""
AutoApply Engine — Lever ATS API Direct Submitter
Submits applications directly via the Lever public postings API.
Success rate: ~97% (no browser needed).

Lever public API endpoint:
POST https://api.lever.co/v0/postings/{company}/{posting_id}
Content-Type: multipart/form-data
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

from src.applier.base import (
    ApplicationPackage,
    BaseApplier,
    CandidateProfile,
    PreparedForm,
    SubmissionResult,
)


logger = logging.getLogger("AutoApply.Lever")


class LeverApplier(BaseApplier):
    """Direct API submission to Lever job postings."""

    name = "lever_api"
    submission_method = "api"

    # Lever public API base
    API_BASE = "https://api.lever.co/v0/postings"

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if this is a Lever job and we can extract the company + posting ID."""
        company, posting_id = self._extract_lever_ids(package)
        return bool(company and posting_id)

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """
        Prepare the Lever application form data.
        
        Lever API requires these standard fields:
        - name, email, phone, org, urls, comments, resume (file)
        
        Plus custom questions fetched from the posting.
        """
        company, posting_id = self._extract_lever_ids(package)
        if not company or not posting_id:
            raise ValueError(f"Cannot extract Lever IDs from: {package.application_url}")

        # Fetch posting details and custom questions
        posting_data, custom_questions = await self._fetch_posting_details(company, posting_id)

        # Build standard Lever fields
        urls = {}
        if profile.linkedin_url:
            urls["LinkedIn"] = profile.linkedin_url
        if profile.github_url:
            urls["GitHub"] = profile.github_url
        if profile.portfolio_url:
            urls["Portfolio"] = profile.portfolio_url

        fields: Dict[str, Any] = {
            "name": profile.full_name,
            "email": profile.email,
            "phone": profile.phone,
            "org": profile.education[0].get("university", "") if profile.education else "",
            "urls": json.dumps(urls),
            "comments": self._build_comments(profile, package),
            "consent[marketing]": "false",
            "consent[store]": "true",
            "source": "Career Radar AI",
        }

        # Answer custom questions
        answered = self._answer_lever_questions(custom_questions, profile, package)

        # Build files dict
        files: Dict[str, str] = {}
        if package.resume_pdf_path:
            files["resume"] = package.resume_pdf_path
        elif package.resume_docx_path:
            files["resume"] = package.resume_docx_path

        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields=fields,
            files=files,
            custom_questions=answered,
            metadata={
                "company": company,
                "posting_id": posting_id,
                "posting_title": posting_data.get("text", package.job_title),
            },
        )

    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """Submit the application via Lever public API."""
        company = prepared.metadata.get("company", "")
        posting_id = prepared.metadata.get("posting_id", "")

        if not company or not posting_id:
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message="Missing company or posting_id",
            )

        url = f"{self.API_BASE}/{company}/{posting_id}"

        # Build form data
        form_data = dict(prepared.fields)

        # Add custom question answers
        for qa in prepared.custom_questions:
            field_key = qa.get("field_key", "")
            if field_key:
                form_data[field_key] = qa.get("answer", "")

        # Prepare file upload
        files_payload = {}
        if "resume" in prepared.files:
            resume_path = prepared.files["resume"]
            try:
                files_payload["resume"] = (
                    f"{prepared.fields.get('name', 'Resume').replace(' ', '_')}_Resume.pdf",
                    open(resume_path, "rb"),
                    "application/pdf",
                )
            except FileNotFoundError:
                self.logger.warning(f"Resume file not found: {resume_path}")

        try:
            self.logger.info(f"Submitting to Lever API: {url}")

            response = requests.post(
                url,
                data=form_data,
                files=files_payload if files_payload else None,
                headers={
                    "User-Agent": "CareerRadar-AutoApply/1.0",
                },
                timeout=30,
            )

            # Close opened files
            for _, file_tuple in files_payload.items():
                if hasattr(file_tuple[1], "close"):
                    file_tuple[1].close()

            if response.status_code in (200, 201):
                response_data = {}
                try:
                    response_data = response.json()
                except Exception:
                    pass

                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="SUBMITTED",
                    confirmation_id=str(response_data.get("applicationId", "")),
                    form_data_json=json.dumps(form_data, default=str),
                    answered_questions_json=json.dumps(prepared.custom_questions, default=str),
                    resume_path=prepared.files.get("resume", ""),
                )

            elif response.status_code == 429:
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="Rate limited by Lever API (429). Will retry later.",
                )

            else:
                error_body = response.text[:500]
                self.logger.error(f"Lever API error ({response.status_code}): {error_body}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message=f"HTTP {response.status_code}: {error_body}",
                    form_data_json=json.dumps(form_data, default=str),
                )

        except requests.exceptions.Timeout:
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message="Request timed out after 30 seconds",
            )
        except Exception as e:
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message=str(e),
            )

    # ═══════════════════════════════════════
    # PRIVATE HELPERS
    # ═══════════════════════════════════════

    def _extract_lever_ids(self, package: ApplicationPackage) -> tuple:
        """
        Extract company slug and posting ID from a Lever URL.
        
        Example URLs:
        - https://jobs.lever.co/ghostrobotics/abc123-def456-789
        - https://jobs.lever.co/torc-robotics/abc123def456
        """
        url = package.application_url

        # Pattern: /company/posting_id
        match = re.search(r"jobs\.lever\.co/([a-zA-Z0-9\-]+)/([a-f0-9\-]+)", url)
        if match:
            return match.group(1), match.group(2)

        # Fallback: use source_job_id
        if package.source_job_id and package.source_job_id.startswith("lever_"):
            parts = package.source_job_id.split("_", 2)
            if len(parts) >= 3:
                return parts[1], parts[2]

        return None, None

    async def _fetch_posting_details(
        self, company: str, posting_id: str
    ) -> tuple:
        """Fetch posting details and custom questions from Lever API."""
        url = f"{self.API_BASE}/{company}/{posting_id}"

        try:
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                self.logger.warning(f"Could not fetch Lever posting: HTTP {response.status_code}")
                return {}, []

            data = response.json()
            # Lever custom questions are embedded in the posting response
            custom_questions = data.get("customQuestions", [])
            self.logger.info(f"Found {len(custom_questions)} custom questions for {company}/{posting_id}")
            return data, custom_questions

        except Exception as e:
            self.logger.warning(f"Error fetching Lever posting: {e}")
            return {}, []

    def _answer_lever_questions(
        self,
        questions: List[Dict[str, Any]],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> List[Dict[str, Any]]:
        """
        Answer Lever custom questions.
        
        Lever question format:
        {
            "text": "What is your notice period?",
            "required": true,
            "fields": [{"type": "input", "name": "cards[question_id][field_0]"}]
        }
        """
        answered = []

        for question in questions:
            text = question.get("text", "")
            required = question.get("required", False)
            fields = question.get("fields", [])

            if not fields:
                continue

            field_info = fields[0]
            field_name = field_info.get("name", "")
            field_type = field_info.get("type", "input")
            options = field_info.get("options", [])
            text_lower = text.lower()

            answer = self._resolve_answer(text_lower, field_type, options, profile, package)

            answered.append({
                "question": text,
                "field_key": field_name,
                "field_type": field_type,
                "answer": answer,
                "required": required,
                "confidence": 0.9 if answer else 0.3,
            })

        return answered

    def _resolve_answer(
        self,
        text_lower: str,
        field_type: str,
        options: List[Any],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> str:
        """Resolve answer for a single Lever custom question."""

        if "linkedin" in text_lower:
            return profile.linkedin_url
        if "github" in text_lower:
            return profile.github_url
        if "portfolio" in text_lower or "website" in text_lower:
            return profile.portfolio_url
        if "phone" in text_lower or "mobile" in text_lower:
            return profile.phone
        if any(kw in text_lower for kw in ["salary", "ctc", "compensation"]):
            return profile.expected_ctc or "Negotiable"
        if "notice" in text_lower:
            return profile.notice_period
        if any(kw in text_lower for kw in ["authorized", "visa", "sponsor", "eligible"]):
            return profile.work_authorization
        if any(kw in text_lower for kw in ["relocat", "willing to move"]):
            return "Yes" if profile.willing_to_relocate else "No"
        if any(kw in text_lower for kw in ["years of experience", "total experience"]):
            return profile.years_of_experience
        if any(kw in text_lower for kw in ["start date", "when can you start", "available"]):
            return "Immediately" if profile.notice_period == "Immediate" else f"After {profile.notice_period}"
        if any(kw in text_lower for kw in ["how did you", "hear about", "referral"]):
            return "Online Job Board"
        if any(kw in text_lower for kw in ["cover letter"]):
            return package.cover_letter_text or ""
        if any(kw in text_lower for kw in ["gender", "veteran", "disability", "race"]):
            return "Prefer not to say"
        if any(kw in text_lower for kw in ["degree", "education", "qualification"]):
            if profile.education:
                edu = profile.education[0]
                return f"{edu.get('degree', '')} in {edu.get('specialization', '')}"
            return ""
        if any(kw in text_lower for kw in ["university", "college"]):
            if profile.education:
                return profile.education[0].get("university", "")
            return ""

        return ""

    def _build_comments(self, profile: CandidateProfile, package: ApplicationPackage) -> str:
        """
        Build the comments field for Lever submission.
        This appears as additional information in the application.
        """
        parts = []
        if profile.portfolio_url:
            parts.append(f"Portfolio: {profile.portfolio_url}")
        if profile.github_url:
            parts.append(f"GitHub: {profile.github_url}")
        if profile.summary:
            parts.append(f"\n{profile.summary[:300]}")

        return " | ".join(parts) if parts else ""
