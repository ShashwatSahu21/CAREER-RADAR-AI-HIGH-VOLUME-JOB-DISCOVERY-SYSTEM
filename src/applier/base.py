"""
AutoApply Engine — Base Applier Interface
All platform-specific appliers (Greenhouse, Lever, LinkedIn, etc.) extend this base class.
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


logger = logging.getLogger("AutoApply.Base")


# ═══════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════

@dataclass
class CandidateProfile:
    """Candidate's complete profile data for auto-filling applications."""
    full_name: str = ""
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    summary: str = ""

    # Standard application answers
    notice_period: str = "Immediate"
    expected_ctc: str = ""
    current_ctc: str = ""
    willing_to_relocate: bool = True
    work_authorization: str = "Indian Citizen"
    years_of_experience: str = "0-1"
    nationality: str = "Indian"
    date_of_birth: str = ""
    languages_known: List[str] = field(default_factory=lambda: ["English", "Hindi"])

    # EEO (Optional)
    gender: str = ""
    veteran_status: str = ""
    disability_status: str = ""

    # File paths
    passport_photo_path: str = ""

    # Education
    education: List[Dict[str, Any]] = field(default_factory=list)

    # Experiences
    experiences: List[Dict[str, Any]] = field(default_factory=list)

    # Projects
    projects: List[Dict[str, Any]] = field(default_factory=list)

    # Skills
    skills: List[Dict[str, Any]] = field(default_factory=list)

    # Pre-approved standard answers for common questions
    standard_answers: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_db(cls, profile_data: Dict[str, Any]) -> "CandidateProfile":
        """Create CandidateProfile from database/API response."""
        full_name = profile_data.get("fullName", "")
        name_parts = full_name.split(" ", 1)

        return cls(
            full_name=full_name,
            first_name=name_parts[0] if name_parts else "",
            last_name=name_parts[1] if len(name_parts) > 1 else "",
            email=profile_data.get("email", ""),
            phone=profile_data.get("phone", ""),
            location=profile_data.get("location", ""),
            linkedin_url=profile_data.get("linkedinUrl", ""),
            github_url=profile_data.get("githubUrl", ""),
            portfolio_url=profile_data.get("portfolioUrl", ""),
            summary=profile_data.get("summary", ""),
            notice_period=profile_data.get("noticePeriod", "Immediate"),
            expected_ctc=profile_data.get("expectedCTC", ""),
            current_ctc=profile_data.get("currentCTC", ""),
            willing_to_relocate=profile_data.get("willingToRelocate", True),
            work_authorization=profile_data.get("workAuthorization", "Indian Citizen"),
            years_of_experience=profile_data.get("yearsOfExperience", "0-1"),
            nationality=profile_data.get("nationality", "Indian"),
            date_of_birth=profile_data.get("dateOfBirth", ""),
            languages_known=_safe_parse_list(profile_data.get("languagesKnown", '["English", "Hindi"]')),
            gender=profile_data.get("gender", ""),
            veteran_status=profile_data.get("veteranStatus", ""),
            disability_status=profile_data.get("disabilityStatus", ""),
            passport_photo_path=profile_data.get("passportPhotoPath", ""),
            education=profile_data.get("education", []),
            experiences=profile_data.get("experiences", []),
            projects=profile_data.get("projects", []),
            skills=profile_data.get("skills", []),
            standard_answers=profile_data.get("standardAnswers", []),
        )


@dataclass
class ApplicationPackage:
    """A ready-to-submit application package for a specific job."""
    job_id: str
    job_title: str
    company: str
    application_url: str
    source: str  # greenhouse, lever, ashby, linkedin, naukri, workday, etc.
    source_job_id: str  # Original job ID from the source platform

    # Generated documents
    resume_pdf_path: str = ""
    resume_docx_path: str = ""
    cover_letter_pdf_path: str = ""
    cover_letter_docx_path: str = ""
    cover_letter_text: str = ""

    # Job analysis data
    match_score: int = 0
    recommendation: str = ""  # HIGH_PRIORITY, STRONG_MATCH, STRETCH
    parsed_job_data: Dict[str, Any] = field(default_factory=dict)

    # AI-generated question answers (pre-computed)
    answered_questions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SubmissionResult:
    """Result of a job application submission attempt."""
    success: bool
    platform: str
    submission_method: str  # "api" or "browser"
    status: str  # "SUBMITTED", "FAILED", "NEEDS_REVIEW"

    # Details
    confirmation_id: str = ""
    error_message: str = ""
    screenshot_path: str = ""
    form_data_json: str = "{}"
    answered_questions_json: str = "[]"
    resume_path: str = ""
    cover_letter_path: str = ""

    # Timestamps
    attempted_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: str = ""


@dataclass
class PreparedForm:
    """A fully prepared form ready for submission."""
    platform: str
    submission_method: str  # "api" or "browser"
    fields: Dict[str, Any] = field(default_factory=dict)
    files: Dict[str, str] = field(default_factory=dict)  # field_name -> file_path
    custom_questions: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


# ═══════════════════════════════════════
# PLATFORM DETECTION
# ═══════════════════════════════════════

def detect_platform(application_url: str, source: str = "") -> str:
    """
    Detects which application platform/applier to use based on the URL and source.
    Returns the platform identifier string.
    """
    url_lower = application_url.lower()

    if "boards.greenhouse.io" in url_lower or "greenhouse" in source.lower():
        return "greenhouse_api"
    if "jobs.lever.co" in url_lower or "lever" in source.lower():
        return "lever_api"
    if "jobs.ashbyhq.com" in url_lower or "ashby" in source.lower():
        return "ashby_api"
    if "linkedin.com" in url_lower or "linkedin" in source.lower():
        return "linkedin_browser"
    if "naukri.com" in url_lower or "naukri" in source.lower():
        return "naukri_browser"
    if "myworkdayjobs.com" in url_lower or "workday" in source.lower():
        return "workday_browser"
    if "internshala.com" in url_lower or "internshala" in source.lower():
        return "generic_browser"

    return "generic_browser"


# ═══════════════════════════════════════
# ABSTRACT BASE APPLIER
# ═══════════════════════════════════════

class BaseApplier(ABC):
    """
    Abstract base class for all job application submitters.
    Each platform adapter (Greenhouse, Lever, LinkedIn, etc.) extends this.
    """

    name: str = "base"
    submission_method: str = "api"  # "api" or "browser"

    def __init__(self):
        self.logger = logging.getLogger(f"AutoApply.{self.name}")
        self.screenshot_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "careerpilot", "storage", "screenshots"
        )
        os.makedirs(self.screenshot_dir, exist_ok=True)

    @abstractmethod
    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if this applier can handle the given job application."""
        pass

    @abstractmethod
    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """
        Prepare the complete form data without submitting.
        Returns a PreparedForm with all fields filled.
        """
        pass

    @abstractmethod
    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """
        Submit the prepared application.
        Returns a SubmissionResult with success/failure status.
        """
        pass

    async def apply(
        self,
        package: ApplicationPackage,
        profile: CandidateProfile,
        dry_run: bool = False
    ) -> SubmissionResult:
        """
        Full application flow: prepare → submit (or dry-run).
        """
        self.logger.info(
            f"Starting application for '{package.job_title}' at {package.company} "
            f"via {self.name} ({'DRY RUN' if dry_run else 'LIVE'})"
        )

        try:
            # Step 1: Verify we can handle this job
            if not await self.can_apply(package):
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message=f"Applier {self.name} cannot handle this job URL: {package.application_url}",
                )

            # Step 2: Prepare the application
            self.logger.info("Preparing application form data...")
            prepared = await self.prepare_application(package, profile)
            self.logger.info(f"Form prepared with {len(prepared.fields)} fields and {len(prepared.files)} files")

            # Step 3: Dry run — return prepared data without submitting
            if dry_run:
                self.logger.info("DRY RUN mode — skipping actual submission")
                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="DRY_RUN",
                    form_data_json=json.dumps(prepared.fields, default=str),
                    answered_questions_json=json.dumps(prepared.custom_questions, default=str),
                    resume_path=prepared.files.get("resume", ""),
                    cover_letter_path=prepared.files.get("cover_letter", ""),
                )

            # Step 4: Submit
            self.logger.info("Submitting application...")
            result = await self.submit(prepared, package)

            if result.success:
                self.logger.info(
                    f"[SUCCESS] Successfully applied to '{package.job_title}' at {package.company} "
                    f"(Confirmation: {result.confirmation_id or 'N/A'})"
                )
            else:
                self.logger.error(
                    f"[FAILED] Failed to apply to '{package.job_title}' at {package.company}: {result.error_message}"
                )

            return result

        except Exception as e:
            self.logger.error(f"Application failed with exception: {e}", exc_info=True)
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message=str(e),
            )

    def _save_screenshot(self, name: str, data: bytes) -> str:
        """Save a screenshot to the screenshots directory. Returns the file path."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        filepath = os.path.join(self.screenshot_dir, filename)
        with open(filepath, "wb") as f:
            f.write(data)
        return filepath


# ═══════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════

def _safe_parse_list(val: Any) -> List[str]:
    """Safely parse a JSON array string into a list."""
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val:
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else [val]
        except (json.JSONDecodeError, TypeError):
            return [val]
    return []
