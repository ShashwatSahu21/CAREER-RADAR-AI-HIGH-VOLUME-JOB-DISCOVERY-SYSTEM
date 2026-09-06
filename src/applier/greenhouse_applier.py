"""
AutoApply Engine — Greenhouse ATS API Direct Submitter
Submits applications directly via the Greenhouse public API.
Success rate: ~98% (no browser needed).

Greenhouse public API endpoint:
POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
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


logger = logging.getLogger("AutoApply.Greenhouse")


class GreenhouseApplier(BaseApplier):
    """Direct API submission to Greenhouse ATS boards."""

    name = "greenhouse_api"
    submission_method = "api"

    # Greenhouse API base URL
    API_BASE = "https://boards-api.greenhouse.io/v1/boards"

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if this is a Greenhouse job and we can extract the board token + job ID."""
        board_token, job_id = self._extract_greenhouse_ids(package)
        return bool(board_token and job_id)

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """
        Prepare the Greenhouse application form data.
        
        Steps:
        1. Extract board_token and job_id from the URL
        2. Fetch the job's custom questions via API
        3. Map candidate profile to standard fields
        4. Answer custom questions using pre-computed answers or profile data
        """
        board_token, job_id = self._extract_greenhouse_ids(package)
        if not board_token or not job_id:
            raise ValueError(f"Cannot extract Greenhouse IDs from: {package.application_url}")

        # Fetch job questions from Greenhouse API
        questions = await self._fetch_job_questions(board_token, job_id)

        # Build standard form fields
        fields: Dict[str, Any] = {
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "location": profile.location,
        }

        # Add optional URL fields
        if profile.linkedin_url:
            fields["urls[LinkedIn]"] = profile.linkedin_url
        if profile.github_url:
            fields["urls[GitHub]"] = profile.github_url
        if profile.portfolio_url:
            fields["urls[Portfolio]"] = profile.portfolio_url

        # Answer custom questions
        custom_answers = self._answer_greenhouse_questions(questions, profile, package)

        # Build files dict
        files: Dict[str, str] = {}
        if package.resume_pdf_path:
            files["resume"] = package.resume_pdf_path
        elif package.resume_docx_path:
            files["resume"] = package.resume_docx_path

        if package.cover_letter_pdf_path:
            files["cover_letter"] = package.cover_letter_pdf_path
        elif package.cover_letter_docx_path:
            files["cover_letter"] = package.cover_letter_docx_path

        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields=fields,
            files=files,
            custom_questions=custom_answers,
            metadata={
                "board_token": board_token,
                "job_id": job_id,
                "questions_count": len(questions),
            },
        )

    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """Submit the application via Greenhouse public API."""
        board_token = prepared.metadata.get("board_token", "")
        job_id = prepared.metadata.get("job_id", "")

        if not board_token or not job_id:
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message="Missing board_token or job_id",
            )

        url = f"{self.API_BASE}/{board_token}/jobs/{job_id}"

        # Build multipart form data
        form_data = dict(prepared.fields)

        # Add custom question answers
        for qa in prepared.custom_questions:
            field_key = qa.get("field_key", "")
            if field_key:
                form_data[field_key] = qa.get("answer", "")

        # Prepare files for upload
        files_payload = {}
        if "resume" in prepared.files:
            resume_path = prepared.files["resume"]
            try:
                files_payload["resume"] = (
                    f"Resume_{prepared.fields.get('first_name', 'Candidate')}.pdf",
                    open(resume_path, "rb"),
                    "application/pdf",
                )
            except FileNotFoundError:
                self.logger.warning(f"Resume file not found: {resume_path}")

        if "cover_letter" in prepared.files:
            cl_path = prepared.files["cover_letter"]
            try:
                files_payload["cover_letter"] = (
                    f"CoverLetter_{prepared.fields.get('first_name', 'Candidate')}.pdf",
                    open(cl_path, "rb"),
                    "application/pdf",
                )
            except FileNotFoundError:
                self.logger.warning(f"Cover letter file not found: {cl_path}")

        try:
            self.logger.info(f"Submitting to Greenhouse API: {url}")

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

                confirmation_id = str(response_data.get("id", ""))

                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="SUBMITTED",
                    confirmation_id=confirmation_id,
                    form_data_json=json.dumps(form_data, default=str),
                    answered_questions_json=json.dumps(prepared.custom_questions, default=str),
                    resume_path=prepared.files.get("resume", ""),
                    cover_letter_path=prepared.files.get("cover_letter", ""),
                )
            else:
                error_body = response.text[:500]
                self.logger.error(f"Greenhouse API error ({response.status_code}): {error_body}")
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

    def _extract_greenhouse_ids(self, package: ApplicationPackage) -> tuple:
        """
        Extract board_token and job_id from a Greenhouse URL.
        
        Example URLs:
        - https://boards.greenhouse.io/figureai/jobs/4123456
        - https://boards.greenhouse.io/embed/job_app?for=figureai&token=4123456
        - https://job-boards.greenhouse.io/figureai/jobs/4123456
        """
        url = package.application_url
        source_job_id = package.source_job_id

        # Pattern 1: /company/jobs/id
        match = re.search(r"greenhouse\.io/(\w+)/jobs/(\d+)", url)
        if match:
            return match.group(1), match.group(2)

        # Pattern 2: embed URL with for= and token=
        match = re.search(r"for=(\w+).*token=(\d+)", url)
        if match:
            return match.group(1), match.group(2)

        # Pattern 3: Use source_job_id if it contains greenhouse info
        if source_job_id and source_job_id.startswith("greenhouse_"):
            parts = source_job_id.split("_")
            if len(parts) >= 3:
                board_token = parts[1]
                job_id = parts[2]
                return board_token, job_id

        # Pattern 4: Try to extract from the URL path
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) >= 3 and path_parts[-2] == "jobs":
            return path_parts[-3], path_parts[-1]

        return None, None

    async def _fetch_job_questions(self, board_token: str, job_id: str) -> List[Dict[str, Any]]:
        """
        Fetch custom questions for a Greenhouse job.
        Uses the public API: GET /v1/boards/{token}/jobs/{id}?questions=true
        """
        url = f"{self.API_BASE}/{board_token}/jobs/{job_id}?questions=true"

        try:
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                self.logger.warning(f"Could not fetch Greenhouse questions: HTTP {response.status_code}")
                return []

            data = response.json()
            questions = data.get("questions", [])
            self.logger.info(f"Found {len(questions)} custom questions for {board_token}/{job_id}")
            return questions

        except Exception as e:
            self.logger.warning(f"Error fetching Greenhouse questions: {e}")
            return []

    def _answer_greenhouse_questions(
        self,
        questions: List[Dict[str, Any]],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> List[Dict[str, Any]]:
        """
        Answer Greenhouse custom questions using candidate profile data.
        
        Greenhouse question format:
        {
            "required": true,
            "label": "LinkedIn Profile",
            "fields": [{"name": "question_12345", "type": "input_text", "values": []}]
        }
        """
        answered = []

        for question in questions:
            label = question.get("label", "")
            required = question.get("required", False)
            fields = question.get("fields", [])

            if not fields:
                continue

            field_info = fields[0]
            field_name = field_info.get("name", "")
            field_type = field_info.get("type", "input_text")
            field_values = field_info.get("values", [])
            label_lower = label.lower()

            # Determine answer based on label content
            answer = self._resolve_question_answer(label_lower, field_type, field_values, profile, package)

            answered.append({
                "question": label,
                "field_key": field_name,
                "field_type": field_type,
                "answer": answer,
                "required": required,
                "confidence": 0.9 if answer else 0.3,
            })

        return answered

    def _resolve_question_answer(
        self,
        label_lower: str,
        field_type: str,
        field_values: List[Dict[str, Any]],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> str:
        """Resolve the answer for a single Greenhouse question."""

        # LinkedIn
        if "linkedin" in label_lower:
            return profile.linkedin_url

        # GitHub
        if "github" in label_lower:
            return profile.github_url

        # Portfolio / Website
        if any(kw in label_lower for kw in ["portfolio", "website", "personal site"]):
            return profile.portfolio_url

        # Phone
        if any(kw in label_lower for kw in ["phone", "mobile", "contact number"]):
            return profile.phone

        # Location / City
        if any(kw in label_lower for kw in ["city", "location", "where are you"]):
            return profile.location

        # Work authorization
        if any(kw in label_lower for kw in ["authorized", "authorization", "eligible to work", "visa", "sponsor"]):
            if field_values:
                return self._best_option_match(profile.work_authorization, field_values)
            if "sponsor" in label_lower:
                return "No"
            return profile.work_authorization

        # Salary / CTC
        if any(kw in label_lower for kw in ["salary", "ctc", "compensation", "pay"]):
            if "current" in label_lower:
                return profile.current_ctc or "0"
            return profile.expected_ctc or "Negotiable"

        # Notice period
        if "notice" in label_lower:
            return profile.notice_period

        # Experience years
        if any(kw in label_lower for kw in ["years of experience", "total experience"]):
            if field_values:
                return self._best_option_match(profile.years_of_experience, field_values)
            return profile.years_of_experience

        # Relocation
        if "relocat" in label_lower:
            if field_values:
                answer = "Yes" if profile.willing_to_relocate else "No"
                return self._best_option_match(answer, field_values)
            return "Yes" if profile.willing_to_relocate else "No"

        # How did you hear about us / Referral
        if any(kw in label_lower for kw in ["how did you", "hear about", "referral", "source"]):
            if field_values:
                return self._best_option_match("Job Board", field_values)
            return "Online Job Board"

        # Gender / EEO
        if any(kw in label_lower for kw in ["gender", "sex", "pronouns"]):
            if field_values:
                return self._best_option_match(profile.gender or "Prefer not to say", field_values)
            return profile.gender or "Prefer not to say"

        # Veteran
        if "veteran" in label_lower:
            if field_values:
                return self._best_option_match(profile.veteran_status or "I am not a protected veteran", field_values)
            return profile.veteran_status or "I am not a protected veteran"

        # Disability
        if "disability" in label_lower or "disabilit" in label_lower:
            if field_values:
                return self._best_option_match(profile.disability_status or "I do not wish to answer", field_values)
            return profile.disability_status or "I do not wish to answer"

        # Race / Ethnicity
        if any(kw in label_lower for kw in ["race", "ethnicity"]):
            if field_values:
                return self._best_option_match("Decline to self-identify", field_values)
            return "Prefer not to say"

        # Cover letter (text)
        if "cover letter" in label_lower and field_type in ("input_text", "textarea"):
            return package.cover_letter_text or ""

        # Start date / Availability
        if any(kw in label_lower for kw in ["start date", "when can you start", "available", "earliest"]):
            if profile.notice_period == "Immediate":
                return "Immediately"
            return f"After {profile.notice_period}"

        # Education / Degree
        if any(kw in label_lower for kw in ["degree", "qualification", "education"]):
            if profile.education:
                edu = profile.education[0]
                return f"{edu.get('degree', '')} in {edu.get('specialization', '')}, {edu.get('university', '')}"
            return ""

        # University
        if any(kw in label_lower for kw in ["university", "college", "school"]):
            if profile.education:
                return profile.education[0].get("university", "")
            return ""

        # GPA
        if any(kw in label_lower for kw in ["gpa", "cgpa", "grade"]):
            if profile.education:
                return profile.education[0].get("cgpa", "")
            return ""

        # Generic Yes/No questions
        if field_values and len(field_values) <= 3:
            # Default to "Yes" for binary questions if we don't understand them
            yes_option = next((v for v in field_values if "yes" in v.get("label", "").lower()), None)
            if yes_option:
                return str(yes_option.get("value", yes_option.get("label", "Yes")))

        # Fallback: return empty for unrecognized questions
        self.logger.info(f"Unrecognized Greenhouse question: '{label_lower}' — leaving blank")
        return ""

    def _best_option_match(self, target: str, options: List[Dict[str, Any]]) -> str:
        """Find the best matching option from a list of Greenhouse question values."""
        target_lower = target.lower().strip()

        # Exact match
        for opt in options:
            opt_label = opt.get("label", "")
            opt_value = str(opt.get("value", opt_label))
            if opt_label.lower().strip() == target_lower:
                return opt_value

        # Substring match
        for opt in options:
            opt_label = opt.get("label", "").lower()
            if target_lower in opt_label or opt_label in target_lower:
                return str(opt.get("value", opt.get("label", "")))

        # Default to first option
        if options:
            return str(options[0].get("value", options[0].get("label", "")))

        return target
