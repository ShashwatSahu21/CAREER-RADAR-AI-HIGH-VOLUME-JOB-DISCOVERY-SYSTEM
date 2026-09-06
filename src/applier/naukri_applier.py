"""
AutoApply Engine — Naukri.com Quick Apply Applier
Automates Naukri job applications using the stealth BrowserEngine.
Handles:
- Session verification & login detection
- 1-Click Apply & Questionnaire chatbot
- Form-based recruiter questions (CTC, Notice Period, Skills)
- Confirmation detection and screenshot auditing
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from src.applier.base import (
    ApplicationPackage,
    BaseApplier,
    CandidateProfile,
    PreparedForm,
    SubmissionResult,
)
from src.applier.browser_engine import BrowserEngine

logger = logging.getLogger("AutoApply.Naukri")


class NaukriApplier(BaseApplier):
    """Applier for Naukri.com job postings via browser automation."""

    name: str = "naukri_browser"
    submission_method: str = "browser"

    def __init__(self, headless: bool = True):
        super().__init__()
        self.headless = headless

    async def can_apply(self, package: ApplicationPackage) -> bool:
        """Check if URL belongs to Naukri."""
        url = package.application_url.lower()
        return "naukri.com" in url or "naukri" in package.source.lower()

    async def prepare_application(
        self, package: ApplicationPackage, profile: CandidateProfile
    ) -> PreparedForm:
        """Prepare metadata before browser run."""
        return PreparedForm(
            platform=self.name,
            submission_method=self.submission_method,
            fields={
                "expected_ctc": profile.expected_ctc,
                "current_ctc": profile.current_ctc,
                "notice_period": profile.notice_period,
                "location": profile.location,
            },
            files={"resume": package.resume_pdf_path},
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
        """Execute full Naukri apply flow."""
        self.logger.info(
            f"Starting Naukri application for '{package.job_title}' at {package.company} "
            f"({'DRY RUN' if dry_run else 'LIVE'})"
        )

        engine = BrowserEngine(headless=self.headless, session_name="naukri")
        answered_questions: List[Dict[str, Any]] = []
        screenshot_path = ""

        try:
            await engine.start()
            page = engine.page

            # 1. Navigate to job posting
            await engine.navigate(package.application_url)
            await engine.human_delay(2.0, 3.5)

            # 2. Check login state
            login_buttons = await page.locator("a:has-text('Login'), button:has-text('Login')").count()
            current_url = page.url
            if "naukri.com/nlogin/login" in current_url or login_buttons > 2:
                screenshot_path = await engine.capture_screenshot("naukri_login_required")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="NEEDS_LOGIN",
                    error_message="Naukri session expired or login required. Please log in first.",
                    screenshot_path=screenshot_path,
                )

            # 3. Locate Apply Button
            # Naukri has multiple apply buttons: 'Apply', 'I am interested', 'Apply on company site'
            apply_selectors = [
                "button#apply-button",
                "button:has-text('Apply')",
                "button:has-text('I am interested')",
                ".apply-button",
            ]

            apply_btn = None
            for sel in apply_selectors:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible():
                        apply_btn = btn
                        break
                except Exception:
                    pass

            if not apply_btn:
                # Check if already applied
                already_applied = await page.locator("text=Already Applied, text=Applied").count() > 0
                screenshot_path = await engine.capture_screenshot(f"naukri_no_btn_{package.job_id}")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="ALREADY_APPLIED" if already_applied else "FAILED",
                    error_message="Already applied or no direct apply button found on this Naukri posting.",
                    screenshot_path=screenshot_path,
                )

            btn_text = (await apply_btn.inner_text()).lower()
            if "company site" in btn_text:
                self.logger.info("Naukri job redirects to external company site.")
                return SubmissionResult(
                    success=False,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="EXTERNAL_REDIRECT",
                    error_message="Job requires external application on company site.",
                )

            if dry_run:
                screenshot_path = await engine.capture_screenshot(f"naukri_dry_run_{package.job_id}")
                return SubmissionResult(
                    success=True,
                    platform=self.name,
                    submission_method=self.submission_method,
                    status="DRY_RUN",
                    screenshot_path=screenshot_path,
                )

            # Click Apply
            await apply_btn.click()
            await engine.human_delay(2.0, 3.5)

            # 4. Handle Recruiter Questionnaire / Chatbot (if presented)
            chat_container = page.locator(".chatbot-container, .apply-drawer, .question-layer")
            if await chat_container.count() > 0 and await chat_container.first.is_visible():
                self.logger.info("Recruiter questionnaire detected on Naukri. Answering questions...")
                await self._handle_naukri_questionnaire(engine, profile, answered_questions)

            # 5. Verify Application Success
            await engine.human_delay(2.0, 3.0)
            success_indicators = [
                "text=Successfully applied",
                "text=Your application has been sent",
                "text=Applied successfully",
                ".apply-message",
            ]

            success = False
            for ind in success_indicators:
                if await page.locator(ind).count() > 0:
                    success = True
                    break

            screenshot_path = await engine.capture_screenshot(f"naukri_result_{package.job_id}")

            return SubmissionResult(
                success=success,
                platform=self.name,
                submission_method=self.submission_method,
                status="SUBMITTED" if success else "FAILED",
                confirmation_id="naukri_quick_apply",
                screenshot_path=screenshot_path,
                answered_questions_json=json.dumps(answered_questions, default=str),
            )

        except Exception as e:
            self.logger.error(f"Naukri apply error: {e}", exc_info=True)
            if engine and engine.page:
                screenshot_path = await engine.capture_screenshot(f"naukri_error_{package.job_id}")
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

    async def _handle_naukri_questionnaire(
        self,
        engine: BrowserEngine,
        profile: CandidateProfile,
        answered_questions: List[Dict[str, Any]],
    ):
        """Answer chat-based questions on Naukri."""
        page = engine.page
        max_questions = 6
        count = 0

        while count < max_questions:
            count += 1
            await engine.human_delay(1.0, 1.5)

            # Text input in chatbot
            chat_input = page.locator(".chatbot-container input, .question-layer input[type='text'], .chat-input").first
            if await chat_input.is_visible():
                # Detect prompt text
                prompt_el = page.locator(".bot-msg, .question-text").last
                prompt = (await prompt_el.inner_text()).lower() if await prompt_el.count() > 0 else ""

                val = "Yes"
                if "notice" in prompt:
                    val = profile.notice_period or "15 Days"
                elif "ctc" in prompt or "salary" in prompt:
                    val = profile.expected_ctc or "Negotiable"
                elif "experience" in prompt:
                    val = profile.years_of_experience or "1"
                elif "location" in prompt or "city" in prompt:
                    val = profile.location

                await chat_input.fill(val)
                await page.keyboard.press("Enter")
                answered_questions.append({"question": prompt, "answer": val})
                await engine.human_delay(1.0, 2.0)
            else:
                # Check for radio or option chips in chat
                chips = page.locator(".chip, .option-btn, .radio-opt").first
                if await chips.is_visible():
                    await chips.click()
                    await engine.human_delay(1.0, 1.5)
                else:
                    break
