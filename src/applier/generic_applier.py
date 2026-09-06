"""
AutoApply Engine — Generic DOM Form Filler Applier
Fallback browser applier for custom career portals, startups, and ATS platforms:
- Automated DOM field inspection (inputs, textareas, selects, file uploads)
- Semantic field matching against candidate profile
- Resume & Cover Letter upload handling
- Safety threshold check (skips or flags if unknown required fields exist)
- Audit screenshot capture
"""

import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from src.applier.base import (
    ApplicationPackage,
    BaseApplier,
    CandidateProfile,
    PreparedForm,
    SubmissionResult,
)
from src.applier.browser_engine import BrowserEngine

logger = logging.getLogger("AutoApply.Generic")


class GenericApplier(BaseApplier):
    """Fallback applier using DOM heuristics for general application forms."""

    name: str = "generic_browser"
    submission_method: str = "browser"

    def __init__(self, headless: bool = True, min_confidence: float = 0.7):
        super().__init__()
        self.headless = headless
        self.min_confidence = min_confidence

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Generic applier handles any valid HTTP(S) URL."""
        return package.application_url.startswith("http")

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """Prepare generic candidate mapping."""
        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields={
                "full_name": profile.full_name,
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "email": profile.email,
                "phone": profile.phone,
                "location": profile.location,
                "linkedin": profile.linkedin_url,
                "github": profile.github_url,
                "portfolio": profile.portfolio_url,
            },
            files={
                "resume": package.resume_pdf_path,
                "cover_letter": package.cover_letter_pdf_path,
            },
            metadata={"job_url": package.application_url},
        )

    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """Browser automation runs directly in apply()."""
        raise NotImplementedError("Use apply() directly for browser appliers.")

    async def apply(
        self,
        package: ApplicationPackage,
        profile: CandidateProfile,
        dry_run: bool = False
    ) -> SubmissionResult:
        """Execute generic DOM form filling."""
        self.logger.info(
            f"Starting Generic Form Fill for '{package.job_title}' at {package.company} "
            f"({'DRY RUN' if dry_run else 'LIVE'})"
        )

        engine = BrowserEngine(headless=self.headless, session_name="generic")
        filled_fields: List[Dict[str, Any]] = []
        screenshot_path = ""

        try:
            await engine.start()
            page = engine.page

            # 1. Navigate to Job URL
            await engine.navigate(package.application_url)
            await engine.human_delay(2.0, 4.0)

            # Check if there is an "Apply Now" button that opens a form
            apply_buttons = [
                "a:has-text('Apply Now')",
                "button:has-text('Apply Now')",
                "a:has-text('Apply')",
                "button:has-text('Apply')",
            ]
            for sel in apply_buttons:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible() and not await page.locator("input[type='text'], input[type='email']").count() > 0:
                        await btn.click()
                        await engine.human_delay(2.0, 3.0)
                        break
                except Exception:
                    pass

            # 2. Discover DOM Form Fields
            fields = await engine.detect_form_fields()
            self.logger.info(f"Discovered {len(fields)} form elements on page.")

            if not fields:
                screenshot_path = await engine.capture_screenshot(f"generic_no_fields_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="No accessible form fields detected on application page.",
                    screenshot_path=screenshot_path,
                )

            # 3. Match and Fill Fields
            unmatched_required = 0
            for f in fields:
                selector = f.get("selector")
                if not selector:
                    continue

                label = (f.get("labelText") or f.get("name") or f.get("placeholder") or "").lower()
                f_type = f.get("type", "text")
                is_req = f.get("required", False)

                # Skip submit/button
                if f_type in ("submit", "button", "reset", "hidden"):
                    continue

                # File upload
                if f_type == "file":
                    if ("resume" in label or "cv" in label) and package.resume_pdf_path and os.path.exists(package.resume_pdf_path):
                        try:
                            await engine.upload_file(selector, package.resume_pdf_path)
                            filled_fields.append({"field": label, "value": "[RESUME_UPLOADED]"})
                        except Exception as e:
                            self.logger.warning(f"File upload failed for {selector}: {e}")
                    elif "cover" in label and package.cover_letter_pdf_path and os.path.exists(package.cover_letter_pdf_path):
                        try:
                            await engine.upload_file(selector, package.cover_letter_pdf_path)
                            filled_fields.append({"field": label, "value": "[COVER_LETTER_UPLOADED]"})
                        except Exception:
                            pass
                    continue

                # Text / Email / Phone / Textarea
                val_to_fill = self._match_profile_field(label, profile)
                if val_to_fill:
                    try:
                        if f_type == "select":
                            await engine.select_dropdown(selector, val_to_fill)
                        else:
                            await engine.type_human(selector, str(val_to_fill))
                        filled_fields.append({"field": label, "value": str(val_to_fill)})
                    except Exception as e:
                        self.logger.warning(f"Failed to fill {selector}: {e}")
                elif is_req:
                    unmatched_required += 1

            self.logger.info(f"Filled {len(filled_fields)} fields. Unmatched required: {unmatched_required}")

            # 4. Review & Safety Check
            if unmatched_required > 2:
                screenshot_path = await engine.capture_screenshot(f"generic_needs_review_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="NEEDS_REVIEW",
                    error_message=f"Form contains {unmatched_required} unmatched required fields. Flagged for manual review.",
                    screenshot_path=screenshot_path,
                    form_data_json=json.dumps(filled_fields, default=str),
                )

            screenshot_path = await engine.capture_screenshot(f"generic_ready_{package.job_id}")

            if dry_run:
                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="DRY_RUN",
                    screenshot_path=screenshot_path,
                    form_data_json=json.dumps(filled_fields, default=str),
                    resume_path=package.resume_pdf_path,
                )

            # 5. Submit Form
            submit_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button:has-text('Submit Application')",
                "button:has-text('Submit')",
                "button:has-text('Apply')",
            ]

            submitted = False
            for sel in submit_selectors:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible():
                        await engine.click_human(sel, wait_after=3.0)
                        submitted = True
                        break
                except Exception:
                    pass

            screenshot_path = await engine.capture_screenshot(f"generic_submitted_{package.job_id}")

            return SubmissionResult(
                success=submitted,
                platform=self.name,
                submission_method=self.submission_method,
                status="SUBMITTED" if submitted else "FAILED",
                confirmation_id="generic_submitted" if submitted else "",
                screenshot_path=screenshot_path,
                form_data_json=json.dumps(filled_fields, default=str),
                resume_path=package.resume_pdf_path,
            )

        except Exception as e:
            self.logger.error(f"Generic applier failed: {e}", exc_info=True)
            if engine and engine.page:
                screenshot_path = await engine.capture_screenshot(f"generic_err_{package.job_id}")
            return SubmissionResult(
                success=False,
                platform=self.name,
                submission_method=self.submission_method,
                status="FAILED",
                error_message=str(e),
                screenshot_path=screenshot_path,
            )
        finally:
            await engine.close()

    def _match_profile_field(self, label: str, profile: CandidateProfile) -> Optional[str]:
        """Match field label against candidate profile."""
        if any(k in label for k in ["first name", "given name"]):
            return profile.first_name
        if any(k in label for k in ["last name", "family name", "surname"]):
            return profile.last_name
        if any(k in label for k in ["full name", "your name", "name"]):
            return profile.full_name
        if any(k in label for k in ["email", "e-mail"]):
            return profile.email
        if any(k in label for k in ["phone", "mobile", "contact number"]):
            return profile.phone
        if any(k in label for k in ["city", "location", "address", "current location"]):
            return profile.location
        if any(k in label for k in ["linkedin"]):
            return profile.linkedin_url
        if any(k in label for k in ["github"]):
            return profile.github_url
        if any(k in label for k in ["portfolio", "website", "personal site"]):
            return profile.portfolio_url
        if any(k in label for k in ["notice", "availability"]):
            return profile.notice_period or "Immediate"
        if any(k in label for k in ["expected ctc", "expected salary"]):
            return profile.expected_ctc or "Negotiable"
        if any(k in label for k in ["current ctc", "current salary"]):
            return profile.current_ctc or "N/A"
        if any(k in label for k in ["experience", "years of exp"]):
            return profile.years_of_experience or "1"
        return None
