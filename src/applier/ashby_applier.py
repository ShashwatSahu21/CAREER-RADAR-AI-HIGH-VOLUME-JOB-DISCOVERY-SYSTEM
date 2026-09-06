"""
AutoApply Engine — Ashby ATS API Direct Submitter
Submits applications via Ashby's public job board API.
Success rate: ~95% (no browser needed).

Ashby public API endpoints:
GET  https://api.ashbyhq.com/posting-api/job-board/{boardId}
POST https://api.ashbyhq.com/posting-api/job-board/{boardId}/jobs/{jobId}/application
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


logger = logging.getLogger("AutoApply.Ashby")


class AshbyApplier(BaseApplier):
    """Direct API submission to Ashby ATS job boards."""

    name = "ashby_api"
    submission_method = "api"

    # Ashby public API base
    API_BASE = "https://api.ashbyhq.com/posting-api/job-board"

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if this is an Ashby job and we can extract the board + job ID."""
        board_id, job_id = self._extract_ashby_ids(package)
        return bool(board_id and job_id)

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """
        Prepare the Ashby application form data.
        
        Steps:
        1. Extract board_id and job_id
        2. Fetch the job's application form schema
        3. Map fields to candidate profile
        4. Answer custom questions
        """
        board_id, job_id = self._extract_ashby_ids(package)
        if not board_id or not job_id:
            raise ValueError(f"Cannot extract Ashby IDs from: {package.application_url}")

        # Fetch job application form schema
        form_schema = await self._fetch_application_form(board_id, job_id)

        # Build standard fields
        fields: Dict[str, Any] = {
            "firstName": profile.first_name,
            "lastName": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "location": profile.location,
            "linkedInUrl": profile.linkedin_url,
            "githubUrl": profile.github_url,
            "websiteUrl": profile.portfolio_url,
        }

        # Answer custom questions from the form schema
        custom_answers = self._answer_ashby_questions(form_schema, profile, package)

        # Build files dict
        files: Dict[str, str] = {}
        if package.resume_pdf_path:
            files["resume"] = package.resume_pdf_path
        elif package.resume_docx_path:
            files["resume"] = package.resume_docx_path

        if package.cover_letter_pdf_path:
            files["coverLetter"] = package.cover_letter_pdf_path

        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields=fields,
            files=files,
            custom_questions=custom_answers,
            metadata={
                "board_id": board_id,
                "job_id": job_id,
                "form_fields_count": len(form_schema),
            },
        )

    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """Submit the application via Ashby public API."""
        board_id = prepared.metadata.get("board_id", "")
        job_id = prepared.metadata.get("job_id", "")

        if not board_id or not job_id:
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message="Missing board_id or job_id",
            )

        url = f"{self.API_BASE}/{board_id}/jobs/{job_id}/application"

        # Build the submission payload
        # Ashby accepts either JSON or multipart form data
        form_data = dict(prepared.fields)

        # Add custom question answers
        for qa in prepared.custom_questions:
            field_key = qa.get("field_key", "")
            if field_key:
                form_data[field_key] = qa.get("answer", "")

        # Prepare file uploads
        files_payload = {}
        if "resume" in prepared.files:
            resume_path = prepared.files["resume"]
            try:
                files_payload["resume"] = (
                    f"{profile_filename(prepared.fields.get('firstName', ''))}_Resume.pdf",
                    open(resume_path, "rb"),
                    "application/pdf",
                )
            except FileNotFoundError:
                self.logger.warning(f"Resume file not found: {resume_path}")

        if "coverLetter" in prepared.files:
            cl_path = prepared.files["coverLetter"]
            try:
                files_payload["coverLetter"] = (
                    f"{profile_filename(prepared.fields.get('firstName', ''))}_CoverLetter.pdf",
                    open(cl_path, "rb"),
                    "application/pdf",
                )
            except FileNotFoundError:
                self.logger.warning(f"Cover letter file not found: {cl_path}")

        try:
            self.logger.info(f"Submitting to Ashby API: {url}")

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

                confirmation_id = str(response_data.get("id", response_data.get("applicationId", "")))

                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="SUBMITTED",
                    confirmation_id=confirmation_id,
                    form_data_json=json.dumps(form_data, default=str),
                    answered_questions_json=json.dumps(prepared.custom_questions, default=str),
                    resume_path=prepared.files.get("resume", ""),
                    cover_letter_path=prepared.files.get("coverLetter", ""),
                )

            elif response.status_code == 422:
                # Validation error — form field issue
                error_body = response.text[:500]
                self.logger.error(f"Ashby validation error: {error_body}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="NEEDS_REVIEW",
                    error_message=f"Validation error: {error_body}",
                    form_data_json=json.dumps(form_data, default=str),
                )

            else:
                error_body = response.text[:500]
                self.logger.error(f"Ashby API error ({response.status_code}): {error_body}")
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

    def _extract_ashby_ids(self, package: ApplicationPackage) -> tuple:
        """
        Extract board_id and job_id from an Ashby URL.
        
        Example URLs:
        - https://jobs.ashbyhq.com/reflexrobotics/abc123-def456
        - https://jobs.ashbyhq.com/company-name/job-slug
        """
        url = package.application_url

        # Pattern: ashbyhq.com/company/job_id
        match = re.search(r"ashbyhq\.com/([a-zA-Z0-9\-]+)/([a-f0-9\-]+)", url)
        if match:
            return match.group(1), match.group(2)

        # Fallback: use source_job_id
        if package.source_job_id and package.source_job_id.startswith("ashby_"):
            parts = package.source_job_id.split("_", 2)
            if len(parts) >= 3:
                return parts[1], parts[2]

        return None, None

    async def _fetch_application_form(self, board_id: str, job_id: str) -> List[Dict[str, Any]]:
        """
        Fetch the application form schema for an Ashby job.
        Returns a list of custom form fields.
        """
        # First try the application form endpoint
        url = f"{self.API_BASE}/{board_id}/jobs/{job_id}"

        try:
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                self.logger.warning(f"Could not fetch Ashby job details: HTTP {response.status_code}")
                return []

            data = response.json()
            form_fields = data.get("applicationFormDefinition", {}).get("sections", [])
            
            # Flatten all fields from sections
            all_fields = []
            for section in form_fields:
                fields = section.get("fields", section.get("fieldEntries", []))
                all_fields.extend(fields)

            self.logger.info(f"Found {len(all_fields)} form fields for {board_id}/{job_id}")
            return all_fields

        except Exception as e:
            self.logger.warning(f"Error fetching Ashby form schema: {e}")
            return []

    def _answer_ashby_questions(
        self,
        form_fields: List[Dict[str, Any]],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> List[Dict[str, Any]]:
        """
        Answer Ashby custom questions from the form schema.
        
        Ashby form field format varies but typically:
        {
            "field": {"path": "some_field_path", "type": "String|Boolean|ValueSelect", "title": "Question text"},
            "isRequired": true
        }
        """
        answered = []

        for field_def in form_fields:
            field_info = field_def.get("field", field_def)
            title = field_info.get("title", field_info.get("label", ""))
            field_path = field_info.get("path", field_info.get("name", ""))
            field_type = field_info.get("type", "String")
            required = field_def.get("isRequired", False)
            select_options = field_info.get("selectableValues", [])

            if not title and not field_path:
                continue

            title_lower = title.lower()

            # Skip standard fields already handled
            if any(skip in field_path.lower() for skip in [
                "firstname", "lastname", "email", "phone", "resume", "linkedin", "github", "website"
            ]):
                continue

            answer = self._resolve_answer(title_lower, field_type, select_options, profile, package)

            answered.append({
                "question": title,
                "field_key": field_path,
                "field_type": field_type,
                "answer": answer,
                "required": required,
                "confidence": 0.9 if answer else 0.3,
            })

        return answered

    def _resolve_answer(
        self,
        title_lower: str,
        field_type: str,
        options: List[Any],
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> str:
        """Resolve answer for a single Ashby question."""

        if any(kw in title_lower for kw in ["salary", "ctc", "compensation"]):
            return profile.expected_ctc or "Negotiable"
        if "notice" in title_lower:
            return profile.notice_period
        if any(kw in title_lower for kw in ["authorized", "visa", "sponsor", "eligible"]):
            if "sponsor" in title_lower:
                return "No"
            return profile.work_authorization
        if "relocat" in title_lower:
            return "Yes" if profile.willing_to_relocate else "No"
        if any(kw in title_lower for kw in ["years of experience", "experience"]):
            return profile.years_of_experience
        if any(kw in title_lower for kw in ["start date", "when can you start", "available"]):
            return "Immediately" if profile.notice_period == "Immediate" else f"After {profile.notice_period}"
        if any(kw in title_lower for kw in ["how did you", "hear about", "referral", "source"]):
            if options:
                return self._best_option(options, "Job Board")
            return "Online Job Board"
        if any(kw in title_lower for kw in ["cover letter"]):
            return package.cover_letter_text or ""
        if any(kw in title_lower for kw in ["gender", "veteran", "disability", "race", "ethnicity"]):
            if options:
                return self._best_option(options, "Prefer not to say")
            return "Prefer not to say"
        if any(kw in title_lower for kw in ["location", "city", "where"]):
            return profile.location
        if any(kw in title_lower for kw in ["degree", "education"]):
            if profile.education:
                edu = profile.education[0]
                return f"{edu.get('degree', '')} in {edu.get('specialization', '')}"
            return ""
        if any(kw in title_lower for kw in ["university", "college"]):
            if profile.education:
                return profile.education[0].get("university", "")
            return ""

        return ""

    def _best_option(self, options: List[Any], target: str) -> str:
        """Find the best matching option from Ashby's selectable values."""
        target_lower = target.lower()

        for opt in options:
            opt_label = ""
            if isinstance(opt, dict):
                opt_label = opt.get("label", opt.get("value", ""))
            elif isinstance(opt, str):
                opt_label = opt
            
            if opt_label.lower() == target_lower:
                return opt_label

        # Substring match
        for opt in options:
            opt_label = ""
            if isinstance(opt, dict):
                opt_label = opt.get("label", opt.get("value", ""))
            elif isinstance(opt, str):
                opt_label = opt
            
            if target_lower in opt_label.lower() or opt_label.lower() in target_lower:
                return opt_label

        # Default to first option
        if options:
            first = options[0]
            if isinstance(first, dict):
                return first.get("label", first.get("value", ""))
            return str(first)

        return target


def profile_filename(name: str) -> str:
    """Create a safe filename from a name."""
    return re.sub(r"[^a-zA-Z0-9]", "_", name or "Candidate").strip("_")
