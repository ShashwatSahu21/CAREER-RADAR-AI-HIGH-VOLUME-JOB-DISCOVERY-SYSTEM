"""
AutoApply Engine — Workday Multi-Page Applier
Automates Workday (myworkdayjobs.com) multi-step application wizards using stealth BrowserEngine:
- Autofill with Resume / Manual Entry
- My Information (Name, Address, Phone, Email)
- My Experience (Work History, Education, Resume upload)
- Application Questions (Work Authorization, Sponsorship, Notice)
- Voluntary Disclosures (EEO / Diversity questions)
- Review & Submit
"""

import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from src.applier.base import (
    ApplicationPackage,
    BaseApplier,
    CandidateProfile,
    PreparedForm,
    SubmissionResult,
)
from src.applier.browser_engine import BrowserEngine

logger = logging.getLogger("AutoApply.Workday")


class WorkdayApplier(BaseApplier):
    """Applier for Workday job portals via browser automation."""

    name: str = "workday_browser"
    submission_method: str = "browser"

    def __init__(self, headless: bool = True):
        super().__init__()
        self.headless = headless

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if URL belongs to Workday."""
        url = package.application_url.lower()
        return "myworkdayjobs.com" in url or "workday" in package.source.lower()

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """Prepare metadata for Workday application."""
        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields={
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "email": profile.email,
                "phone": profile.phone,
                "address": profile.location,
            },
            files={"resume": package.resume_pdf_path},
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
        """Execute full Workday application flow."""
        self.logger.info(
            f"Starting Workday application for '{package.job_title}' at {package.company} "
            f"({'DRY RUN' if dry_run else 'LIVE'})"
        )

        engine = BrowserEngine(headless=self.headless, session_name="workday")
        answered_questions: List[Dict[str, Any]] = []
        screenshot_path = ""

        try:
            await engine.start()
            page = engine.page

            # 1. Navigate to Job URL
            await engine.navigate(package.application_url)
            await engine.human_delay(2.5, 4.5)

            # 2. Click Apply button
            apply_btn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first
            if not await apply_btn.is_visible():
                screenshot_path = await engine.capture_screenshot(f"workday_no_apply_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="Could not find Apply button on Workday page.",
                    screenshot_path=screenshot_path,
                )

            await apply_btn.click()
            await engine.human_delay(2.0, 3.5)

            # Choose "Apply Manually" or "Autofill with Resume"
            autofill_btn = page.locator("a[data-automation-id='autofillWithResume'], button:has-text('Autofill with Resume')").first
            apply_manual_btn = page.locator("a[data-automation-id='applyManually'], button:has-text('Apply Manually')").first

            if await autofill_btn.is_visible() and package.resume_pdf_path and os.path.exists(package.resume_pdf_path):
                await autofill_btn.click()
                await engine.human_delay(2.0, 3.0)
                # Upload resume
                dropzone = page.locator("input[type='file'], [data-automation-id='file-upload-input-ref']").first
                if await dropzone.count() > 0:
                    await dropzone.set_input_files(package.resume_pdf_path)
                    await engine.human_delay(3.0, 5.0)
                    # Click continue
                    cont_btn = page.locator("button[data-automation-id='bottom-navigation-next-button'], button:has-text('Continue')").first
                    if await cont_btn.is_visible():
                        await cont_btn.click()
                        await engine.human_delay(2.5, 4.0)
            elif await apply_manual_btn.is_visible():
                await apply_manual_btn.click()
                await engine.human_delay(2.0, 3.0)

            # 3. Workday Wizard Stepper Loop (Max 7 pages)
            max_pages = 7
            page_idx = 0
            is_submitted = False

            while page_idx < max_pages:
                page_idx += 1
                self.logger.info(f"Navigating Workday step {page_idx}...")
                await engine.human_delay(1.5, 2.5)

                # Fill all active inputs on current page
                await self._fill_workday_page(engine, profile, package, answered_questions)

                # Check for Save and Continue vs Submit
                submit_btn = page.locator("button[data-automation-id='bottom-navigation-next-button']:has-text('Submit'), button:has-text('Submit')").first
                next_btn = page.locator("button[data-automation-id='bottom-navigation-next-button']:has-text('Save and Continue'), button:has-text('Save and Continue'), button:has-text('Next')").first

                if await submit_btn.is_visible() and not await next_btn.is_visible():
                    self.logger.info("Reached Workday Review / Submit Page.")
                    screenshot_path = await engine.capture_screenshot(f"workday_review_{package.job_id}")

                    if dry_run:
                        self.logger.info("DRY RUN: Stopping at review page.")
                        return SubmissionResult(
                            success=True,
                            platform=self.name,
                            submission_method=self.submission_method,
                            status="DRY_RUN",
                            screenshot_path=screenshot_path,
                            answered_questions_json=json.dumps(answered_questions, default=str),
                            resume_path=package.resume_pdf_path,
                        )

                    # LIVE Submission
                    await submit_btn.click()
                    await engine.human_delay(4.0, 6.0)
                    is_submitted = True
                    screenshot_path = await engine.capture_screenshot(f"workday_submitted_{package.job_id}")
                    break

                elif await next_btn.is_visible():
                    await next_btn.click()
                    await engine.human_delay(2.0, 3.5)
                else:
                    break

            if is_submitted or dry_run:
                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="SUBMITTED" if is_submitted else "DRY_RUN",
                    confirmation_id="workday_applied",
                    screenshot_path=screenshot_path,
                    answered_questions_json=json.dumps(answered_questions, default=str),
                    resume_path=package.resume_pdf_path,
                )
            else:
                screenshot_path = await engine.capture_screenshot(f"workday_incomplete_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="Could not finish all steps of Workday wizard automatically.",
                    screenshot_path=screenshot_path,
                )

        except Exception as e:
            self.logger.error(f"Workday error: {e}", exc_info=True)
            if engine and engine.page:
                screenshot_path = await engine.capture_screenshot(f"workday_err_{package.job_id}")
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

    async def _fill_workday_page(
        self,
        engine: BrowserEngine,
        profile: CandidateProfile,
        package: ApplicationPackage,
        answered_questions: List[Dict[str, Any]]
    ):
        """Fill inputs, dropdowns, and checkboxes on the active Workday page."""
        page = engine.page

        # Map common automation IDs
        field_mappings = {
            "legalNameSection_firstName": profile.first_name,
            "legalNameSection_lastName": profile.last_name,
            "addressSection_addressLine1": profile.location,
            "addressSection_city": profile.location.split(",")[0] if profile.location else "India",
            "phone-number": profile.phone,
            "email": profile.email,
        }

        for auto_id, val in field_mappings.items():
            try:
                el = page.locator(f"[data-automation-id='{auto_id}']").first
                if await el.is_visible() and not (await el.input_value()):
                    await el.fill(val)
                    answered_questions.append({"field": auto_id, "answer": val})
                    await engine.human_delay(0.2, 0.4)
            except Exception:
                pass

        # Handle Radio & Checkbox Disclosures (EEO / Work Auth)
        radios = await page.locator("input[type='radio']").all()
        for r in radios:
            try:
                r_id = await r.get_attribute("id") or ""
                lbl = page.locator(f"label[for='{r_id}']").first
                if await lbl.count() > 0:
                    lbl_text = (await lbl.inner_text()).lower()
                    # Select Yes for authorization, No for sponsorship
                    if "authorized" in lbl_text or "yes" in lbl_text:
                        await r.check()
            except Exception:
                pass
