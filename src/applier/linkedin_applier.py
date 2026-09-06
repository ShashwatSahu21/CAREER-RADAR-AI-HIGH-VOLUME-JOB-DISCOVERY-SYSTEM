"""
AutoApply Engine — LinkedIn Easy Apply Applier
Automates multi-step LinkedIn Easy Apply applications using the stealth BrowserEngine.
Handles:
- Contact info validation
- Resume upload / selection
- Work experience & education inputs
- Screening question answering (Radio, Dropdown, Text, Numeric)
- Multi-step modal navigation (Next -> Review -> Submit)
- Anti-detection delays and session persistence
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

logger = logging.getLogger("AutoApply.LinkedIn")


class LinkedInApplier(BaseApplier):
    """Applier for LinkedIn Easy Apply jobs using browser automation."""

    name: str = "linkedin_browser"
    submission_method: str = "browser"

    def __init__(self, headless: bool = True):
        super().__init__()
        self.headless = headless

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if URL belongs to LinkedIn."""
        url = package.application_url.lower()
        return "linkedin.com" in url or "linkedin" in package.source.lower()

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """Prepare metadata and mapping rules before browser execution."""
        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields={
                "phone": profile.phone,
                "email": profile.email,
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "city": profile.location,
                "years_experience": profile.years_of_experience,
                "notice_period": profile.notice_period,
            },
            files={
                "resume": package.resume_pdf_path,
                "cover_letter": package.cover_letter_pdf_path,
            },
            metadata={"job_url": package.application_url},
        )

    async def submit(self, prepared: PreparedForm, package: ApplicationPackage) -> SubmissionResult:
        """Browser automation will run inside apply() override."""
        raise NotImplementedError("Use apply() directly for browser appliers.")

    async def apply(
        self,
        package: ApplicationPackage,
        profile: CandidateProfile,
        dry_run: bool = False
    ) -> SubmissionResult:
        """Execute full LinkedIn Easy Apply flow."""
        self.logger.info(
            f"Starting LinkedIn Easy Apply for '{package.job_title}' at {package.company} "
            f"({'DRY RUN' if dry_run else 'LIVE'})"
        )

        engine = BrowserEngine(headless=self.headless, session_name="linkedin")
        answered_questions: List[Dict[str, Any]] = []
        screenshot_path = ""

        try:
            await engine.start()
            page = engine.page

            # 1. Navigate to Job URL
            await engine.navigate(package.application_url)
            await engine.human_delay(2.0, 4.0)

            # Check if login is needed
            if "linkedin.com/login" in page.url or "authwall" in page.url:
                screenshot_path = await engine.capture_screenshot("linkedin_login_required")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="NEEDS_LOGIN",
                    error_message="LinkedIn session expired or login required. Please run interactive login.",
                    screenshot_path=screenshot_path,
                )

            # 2. Locate Easy Apply button
            apply_btn_selectors = [
                ".jobs-apply-button",
                "button.jobs-apply-button--top-card",
                "button[aria-label*='Easy Apply']",
                "button:has-text('Easy Apply')",
            ]

            apply_button = None
            for sel in apply_btn_selectors:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible():
                        apply_button = btn
                        break
                except Exception:
                    pass

            if not apply_button:
                screenshot_path = await engine.capture_screenshot("linkedin_no_easy_apply")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="Job is not an Easy Apply job (requires external application or already applied).",
                    screenshot_path=screenshot_path,
                )

            # Click Easy Apply
            await apply_button.click()
            await engine.human_delay(1.5, 3.0)

            # 3. Multi-step Modal Loop
            modal_selector = "div[role='dialog'], .jobs-easy-apply-modal"
            max_steps = 10
            step_count = 0
            is_submitted = False

            while step_count < max_steps:
                step_count += 1
                self.logger.info(f"Processing Easy Apply step {step_count}...")
                await engine.human_delay(1.0, 2.0)

                # Check if modal is still open
                modal_exists = await page.locator(modal_selector).count() > 0
                if not modal_exists:
                    self.logger.info("Modal closed — checking if submitted.")
                    break

                # Fill current step's form fields
                await self._fill_current_step(engine, profile, package, answered_questions)

                # Check for Submit button or Next / Review button
                submit_btn = page.locator("button[aria-label*='Submit application'], button:has-text('Submit application')").first
                review_btn = page.locator("button[aria-label*='Review'], button:has-text('Review')").first
                next_btn = page.locator("button[aria-label*='Continue to next step'], button:has-text('Next')").first

                if await submit_btn.is_visible():
                    self.logger.info("Reached Final Submit Step.")
                    screenshot_path = await engine.capture_screenshot(f"linkedin_review_{package.job_id}")

                    if dry_run:
                        self.logger.info("DRY RUN: Skipping final Submit click.")
                        # Dismiss modal safely
                        close_btn = page.locator("button[aria-label='Dismiss'], button[data-test-modal-close-btn]").first
                        if await close_btn.is_visible():
                            await close_btn.click()
                            await engine.human_delay(0.5, 1.0)
                            discard_btn = page.locator("button[data-control-name='discard_application_confirm_btn'], button:has-text('Discard')").first
                            if await discard_btn.is_visible():
                                await discard_btn.click()

                        return SubmissionResult(
                            success=True,
                            platform=self.name,
                            submission_method=self.submission_method,
                            status="DRY_RUN",
                            screenshot_path=screenshot_path,
                            answered_questions_json=json.dumps(answered_questions, default=str),
                            resume_path=package.resume_pdf_path,
                        )

                    # LIVE: Click Submit
                    await submit_btn.click()
                    await engine.human_delay(3.0, 5.0)
                    is_submitted = True
                    screenshot_path = await engine.capture_screenshot(f"linkedin_submitted_{package.job_id}")
                    break

                elif await review_btn.is_visible():
                    await review_btn.click()
                    await engine.human_delay(1.5, 2.5)

                elif await next_btn.is_visible():
                    await next_btn.click()
                    await engine.human_delay(1.5, 2.5)

                    # Check for validation errors
                    errors = await page.locator(".artdeco-inline-feedback--error").count()
                    if errors > 0:
                        self.logger.warning(f"Detected {errors} form validation errors on step {step_count}")
                        # Capture and stop
                        screenshot_path = await engine.capture_screenshot(f"linkedin_val_error_{package.job_id}")
                        break
                else:
                    self.logger.warning("No Next/Review/Submit button found.")
                    break

            if is_submitted or dry_run:
                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="SUBMITTED" if is_submitted else "DRY_RUN",
                    confirmation_id="linkedin_applied",
                    screenshot_path=screenshot_path,
                    answered_questions_json=json.dumps(answered_questions, default=str),
                    resume_path=package.resume_pdf_path,
                )
            else:
                screenshot_path = await engine.capture_screenshot(f"linkedin_incomplete_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="FAILED",
                    error_message="Easy Apply flow could not be completed automatically (complex custom questions or validation errors).",
                    screenshot_path=screenshot_path,
                    answered_questions_json=json.dumps(answered_questions, default=str),
                )

        except Exception as e:
            self.logger.error(f"LinkedIn application failed: {e}", exc_info=True)
            if engine and engine.page:
                screenshot_path = await engine.capture_screenshot(f"linkedin_error_{package.job_id}")
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

    async def _fill_current_step(
        self,
        engine: BrowserEngine,
        profile: CandidateProfile,
        package: ApplicationPackage,
        answered_questions: List[Dict[str, Any]]
    ):
        """Inspect and fill form fields in the current step."""
        page = engine.page

        # 1. Resume Upload / Selection
        resume_inputs = await page.locator("input[type='file']").count()
        if resume_inputs > 0 and package.resume_pdf_path and os.path.exists(package.resume_pdf_path):
            try:
                await page.locator("input[type='file']").first.set_input_files(package.resume_pdf_path)
                await engine.human_delay(1.0, 2.0)
            except Exception as e:
                self.logger.warning(f"Resume upload failed: {e}")

        # 2. Text & Numeric Inputs
        text_inputs = await page.locator("div[role='dialog'] input[type='text'], div[role='dialog'] input[type='number'], div[role='dialog'] textarea").all()
        for inp in text_inputs:
            try:
                # Get label text
                inp_id = await inp.get_attribute("id") or ""
                label_text = ""
                if inp_id:
                    lbl = page.locator(f"label[for='{inp_id}']").first
                    if await lbl.count() > 0:
                        label_text = (await lbl.inner_text()).strip()

                if not label_text:
                    aria_lbl = await inp.get_attribute("aria-label")
                    if aria_lbl:
                        label_text = aria_lbl.strip()

                current_val = await inp.input_value()
                if current_val:  # Already pre-filled
                    continue

                # Auto-fill based on label patterns
                val_to_fill = self._determine_answer(label_text, profile, package)
                if val_to_fill:
                    await inp.fill(str(val_to_fill))
                    answered_questions.append({
                        "question": label_text,
                        "answer": val_to_fill,
                    })
                    await engine.human_delay(0.2, 0.5)
            except Exception:
                pass

        # 3. Radio Buttons (Yes/No screening questions)
        fieldset_blocks = await page.locator("fieldset").all()
        for fs in fieldset_blocks:
            try:
                legend = fs.locator("legend").first
                question_text = (await legend.inner_text()).strip() if await legend.count() > 0 else ""
                
                # Determine answer
                answer = self._determine_radio_answer(question_text, profile)
                if answer:
                    opt = fs.locator(f"label:has-text('{answer}')").first
                    if await opt.count() > 0 and not await opt.locator("input").is_checked():
                        await opt.click()
                        answered_questions.append({
                            "question": question_text,
                            "answer": answer,
                        })
                        await engine.human_delay(0.2, 0.4)
            except Exception:
                pass

        # 4. Select Dropdowns
        selects = await page.locator("div[role='dialog'] select").all()
        for sel in selects:
            try:
                sel_id = await sel.get_attribute("id") or ""
                label_text = ""
                if sel_id:
                    lbl = page.locator(f"label[for='{sel_id}']").first
                    if await lbl.count() > 0:
                        label_text = (await lbl.inner_text()).strip()

                ans = self._determine_answer(label_text, profile, package)
                if ans:
                    await sel.select_option(label=str(ans))
                    answered_questions.append({
                        "question": label_text,
                        "answer": ans,
                    })
            except Exception:
                pass

    def _determine_answer(self, label: str, profile: CandidateProfile, package: ApplicationPackage) -> str:
        """Determine human-like response for generic text/numeric questions."""
        lbl = label.lower()
        if any(k in lbl for k in ["phone", "mobile", "contact"]):
            return profile.phone
        if any(k in lbl for k in ["city", "location", "address"]):
            return profile.location
        if any(k in lbl for k in ["years of experience", "how many years", "experience with"]):
            # For specific skill experience, default to 1-3
            return "2"
        if any(k in lbl for k in ["notice period", "how soon"]):
            return profile.notice_period or "Immediate"
        if any(k in lbl for k in ["expected ctc", "salary", "compensation"]):
            return profile.expected_ctc or "Negotiable"
        if any(k in lbl for k in ["current ctc"]):
            return profile.current_ctc or "Not Applicable"
        if any(k in lbl for k in ["github"]):
            return profile.github_url
        if any(k in lbl for k in ["linkedin"]):
            return profile.linkedin_url
        if any(k in lbl for k in ["portfolio", "website"]):
            return profile.portfolio_url
        return ""

    def _determine_radio_answer(self, question: str, profile: CandidateProfile) -> Optional[str]:
        """Determine Yes/No response for standard screening questions."""
        q = question.lower()
        # Work authorization / Legal right
        if any(k in q for k in ["authorized to work", "legally authorized", "eligible to work"]):
            return "Yes"
        # Sponsorship requirement
        if any(k in q for k in ["require sponsorship", "require visa", "now or in the future"]):
            return "No"
        # Relocation
        if any(k in q for k in ["relocate", "willing to relocate"]):
            return "Yes" if profile.willing_to_relocate else "No"
        # Background check / Drug test
        if any(k in q for k in ["background check", "drug screen"]):
            return "Yes"
        # Commute / On-site
        if any(k in q for k in ["commute", "on-site", "hybrid"]):
            return "Yes"
        # 18 years or older
        if any(k in q for k in ["18 years", "at least 18"]):
            return "Yes"
        # Degree / Education
        if any(k in q for k in ["bachelor", "degree", "completed"]):
            return "Yes"

        # Default fallback for unknown screening questions
        return "Yes"
