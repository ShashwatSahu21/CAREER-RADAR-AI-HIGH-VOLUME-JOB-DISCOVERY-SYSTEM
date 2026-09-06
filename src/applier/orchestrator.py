"""
AutoApply Engine — Application Orchestrator
The brain that coordinates the full auto-apply pipeline:
1. Fetches jobs ready for application from the database
2. Detects the right applier for each job
3. Prepares and submits applications
4. Logs results and handles retries
"""

import asyncio
import json
import logging
import os
import random
import sys
import argparse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from src.applier.base import (
    ApplicationPackage,
    BaseApplier,
    CandidateProfile,
    SubmissionResult,
    detect_platform,
)
from src.applier.greenhouse_applier import GreenhouseApplier
from src.applier.lever_applier import LeverApplier
from src.applier.ashby_applier import AshbyApplier
from src.applier.linkedin_applier import LinkedInApplier
from src.applier.naukri_applier import NaukriApplier
from src.applier.workday_applier import WorkdayApplier
from src.applier.generic_applier import GenericApplier


logger = logging.getLogger("AutoApply.Orchestrator")


# ═══════════════════════════════════════
# APPLIER REGISTRY
# ═══════════════════════════════════════

def get_api_appliers() -> Dict[str, BaseApplier]:
    """Returns all API-based appliers (no browser needed)."""
    return {
        "greenhouse_api": GreenhouseApplier(),
        "lever_api": LeverApplier(),
        "ashby_api": AshbyApplier(),
    }


def get_browser_appliers() -> Dict[str, BaseApplier]:
    """Returns all browser-based appliers."""
    return {
        "linkedin_browser": LinkedInApplier(),
        "naukri_browser": NaukriApplier(),
        "workday_browser": WorkdayApplier(),
        "generic_browser": GenericApplier(),
    }


def get_all_appliers() -> Dict[str, BaseApplier]:
    """Returns all registered appliers."""
    appliers = get_api_appliers()
    appliers.update(get_browser_appliers())
    return appliers


def get_applier_for_platform(platform: str) -> Optional[BaseApplier]:
    """Get the appropriate applier for a given platform."""
    all_appliers = get_all_appliers()
    if platform in all_appliers:
        return all_appliers[platform]

    logger.warning(f"No applier available for platform: {platform}")
    return None


# ═══════════════════════════════════════
# APPLICATION QUEUE (File-based for Phase 1)
# ═══════════════════════════════════════

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

QUEUE_FILE = os.path.join(ROOT_DIR, "data", "apply_queue.json")
RESULTS_FILE = os.path.join(ROOT_DIR, "data", "apply_results.json")
PROFILE_FILE = os.path.join(ROOT_DIR, "data", "candidate_profile.json")


def load_apply_queue() -> List[Dict[str, Any]]:
    """Load the application queue from file."""
    if not os.path.exists(QUEUE_FILE):
        return []
    try:
        with open(QUEUE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading apply queue: {e}")
        return []


def save_apply_queue(queue: List[Dict[str, Any]]):
    """Save the application queue to file."""
    os.makedirs(os.path.dirname(QUEUE_FILE), exist_ok=True)
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f, indent=2)


def load_apply_results() -> List[Dict[str, Any]]:
    """Load application results history."""
    if not os.path.exists(RESULTS_FILE):
        return []
    try:
        with open(RESULTS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def save_apply_results(results: List[Dict[str, Any]]):
    """Save application results."""
    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    with open(RESULTS_FILE, "w") as f:
        json.dump(results, f, indent=2, default=str)


def load_candidate_profile() -> Optional[CandidateProfile]:
    """Load candidate profile from file."""
    if not os.path.exists(PROFILE_FILE):
        logger.error(f"Candidate profile not found at {PROFILE_FILE}")
        logger.error("Please create data/candidate_profile.json with your details.")
        return None
    try:
        with open(PROFILE_FILE, "r") as f:
            data = json.load(f)
        return CandidateProfile.from_db(data)
    except Exception as e:
        logger.error(f"Error loading candidate profile: {e}")
        return None


# ═══════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════

class AutoApplyOrchestrator:
    """
    Main orchestration engine for automated job applications.
    
    Workflow:
    1. Load candidate profile
    2. Load application queue (jobs ready to apply)
    3. For each job, ordered by priority:
       a. Detect the appropriate platform/applier
       b. Create ApplicationPackage from job data
       c. Call applier.apply()
       d. Log the result
    4. Respect daily quotas and rate limits
    """

    def __init__(
        self,
        mode: str = "api-only",  # "api-only", "browser-only", "all"
        max_applications: int = 50,
        dry_run: bool = False,
        delay_min: int = 5,      # Min seconds between API applications
        delay_max: int = 15,     # Max seconds between API applications
    ):
        self.mode = mode
        self.max_applications = max_applications
        self.dry_run = dry_run
        self.delay_min = delay_min
        self.delay_max = delay_max

        if self.mode == "api-only":
            self.appliers = get_api_appliers()
        elif self.mode == "browser-only":
            self.appliers = get_browser_appliers()
        else:
            self.appliers = get_all_appliers()
        self.results: List[SubmissionResult] = []
        self.applied_count = 0
        self.failed_count = 0
        self.skipped_count = 0

    async def run(self) -> Dict[str, Any]:
        """
        Execute the auto-apply pipeline.
        Returns a summary of results.
        """
        logger.info("=" * 60)
        logger.info("[AutoApply Engine Starting]")
        logger.info(f"   Mode: {self.mode}")
        logger.info(f"   Max Applications: {self.max_applications}")
        logger.info(f"   Dry Run: {self.dry_run}")
        logger.info("=" * 60)

        # Step 1: Load candidate profile
        profile = load_candidate_profile()
        if not profile:
            logger.error("Cannot proceed without candidate profile.")
            return self._summary("FAILED", "Candidate profile not found")

        logger.info(f"Loaded profile for: {profile.full_name} ({profile.email})")

        # Step 2: Load application queue
        queue = load_apply_queue()
        if not queue:
            logger.info("Application queue is empty. Nothing to apply to.")
            return self._summary("COMPLETED", "Queue empty")

        logger.info(f"Loaded {len(queue)} jobs from application queue")

        # Step 3: Sort by priority (higher first), then by match score
        queue.sort(key=lambda j: (j.get("priority", 0), j.get("match_score", 0)), reverse=True)

        # Step 4: Filter by mode
        if self.mode == "api-only":
            queue = [j for j in queue if detect_platform(j.get("application_url", ""), j.get("source", "")).endswith("_api")]
        elif self.mode == "browser-only":
            queue = [j for j in queue if detect_platform(j.get("application_url", ""), j.get("source", "")).endswith("_browser")]

        logger.info(f"After mode filter ({self.mode}): {len(queue)} jobs eligible")

        # Step 5: Apply to each job
        results_history = load_apply_results()
        applied_job_ids = {r.get("job_id") for r in results_history if r.get("status") == "SUBMITTED"}

        for job_data in queue:
            if self.applied_count >= self.max_applications:
                logger.info(f"Reached daily limit of {self.max_applications} applications. Stopping.")
                break

            job_id = job_data.get("job_id", "")

            # Skip already applied jobs
            if job_id in applied_job_ids:
                logger.info(f"Skipping already applied: {job_data.get('title', '')} at {job_data.get('company', '')}")
                self.skipped_count += 1
                continue

            # Create ApplicationPackage
            package = ApplicationPackage(
                job_id=job_id,
                job_title=job_data.get("title", ""),
                company=job_data.get("company", ""),
                application_url=job_data.get("application_url", job_data.get("apply_link", "")),
                source=job_data.get("source", ""),
                source_job_id=job_data.get("source_job_id", job_data.get("job_id", "")),
                resume_pdf_path=job_data.get("resume_pdf_path", ""),
                resume_docx_path=job_data.get("resume_docx_path", ""),
                cover_letter_pdf_path=job_data.get("cover_letter_pdf_path", ""),
                cover_letter_text=job_data.get("cover_letter_text", ""),
                match_score=job_data.get("match_score", 0),
                recommendation=job_data.get("recommendation", ""),
                parsed_job_data=job_data.get("parsed_job_data", {}),
            )

            # Detect platform
            platform = detect_platform(package.application_url, package.source)
            applier = get_applier_for_platform(platform)

            if not applier:
                logger.warning(f"No applier for platform '{platform}' — skipping {package.job_title}")
                self.skipped_count += 1
                continue

            # Apply
            try:
                result = await applier.apply(package, profile, dry_run=self.dry_run)
                self.results.append(result)

                # Record result
                result_record = {
                    "job_id": job_id,
                    "job_title": package.job_title,
                    "company": package.company,
                    "platform": platform,
                    "status": result.status,
                    "success": result.success,
                    "confirmation_id": result.confirmation_id,
                    "error_message": result.error_message,
                    "match_score": package.match_score,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                results_history.append(result_record)

                if result.success:
                    self.applied_count += 1
                    applied_job_ids.add(job_id)
                    logger.info(
                        f"[SUCCESS] [{self.applied_count}/{self.max_applications}] "
                        f"Applied to {package.job_title} at {package.company} via {platform}"
                    )
                else:
                    self.failed_count += 1
                    logger.error(
                        f"[FAILED] Failed: {package.job_title} at {package.company} - {result.error_message}"
                    )

            except Exception as e:
                self.failed_count += 1
                logger.error(f"Exception applying to {package.job_title}: {e}", exc_info=True)
                results_history.append({
                    "job_id": job_id,
                    "job_title": package.job_title,
                    "company": package.company,
                    "platform": platform,
                    "status": "FAILED",
                    "success": False,
                    "error_message": str(e),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            # Rate limiting delay between applications
            if self.applied_count < self.max_applications and not self.dry_run:
                delay = random.uniform(self.delay_min, self.delay_max)
                logger.info(f"Waiting {delay:.1f}s before next application...")
                await asyncio.sleep(delay)

        # Save results
        save_apply_results(results_history)

        # Remove successfully applied jobs from queue
        remaining_queue = [
            j for j in queue
            if j.get("job_id", "") not in applied_job_ids or j.get("job_id", "") in {
                r.get("job_id") for r in results_history if not r.get("success", False)
            }
        ]
        save_apply_queue(remaining_queue)

        summary = self._summary("COMPLETED")
        self._log_summary(summary)
        return summary

    def _summary(self, status: str, message: str = "") -> Dict[str, Any]:
        """Generate a summary of the auto-apply run."""
        return {
            "status": status,
            "message": message,
            "mode": self.mode,
            "dry_run": self.dry_run,
            "applied": self.applied_count,
            "failed": self.failed_count,
            "skipped": self.skipped_count,
            "max_applications": self.max_applications,
            "timestamp": datetime.utcnow().isoformat(),
            "results": [
                {
                    "platform": r.platform,
                    "status": r.status,
                    "success": r.success,
                    "confirmation_id": r.confirmation_id,
                    "error_message": r.error_message,
                }
                for r in self.results
            ],
        }

    def _log_summary(self, summary: Dict[str, Any]):
        """Log a formatted summary of the run."""
        logger.info("=" * 60)
        logger.info("[AutoApply Run Summary]")
        logger.info(f"   Status: {summary['status']}")
        logger.info(f"   Applied: {summary['applied']}")
        logger.info(f"   Failed: {summary['failed']}")
        logger.info(f"   Skipped: {summary['skipped']}")
        logger.info(f"   Mode: {summary['mode']}")
        logger.info(f"   Dry Run: {summary['dry_run']}")
        logger.info("=" * 60)


# ═══════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════

async def main():
    """CLI entry point for the AutoApply orchestrator."""
    parser = argparse.ArgumentParser(description="AutoApply Engine — Automated Job Application Submitter")
    parser.add_argument("--mode", choices=["api-only", "browser-only", "all"], default="api-only",
                        help="Which appliers to use (default: api-only)")
    parser.add_argument("--max-applications", type=int, default=50,
                        help="Maximum number of applications to submit (default: 50)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Prepare applications without actually submitting")
    parser.add_argument("--delay-min", type=int, default=5,
                        help="Minimum delay (seconds) between API applications (default: 5)")
    parser.add_argument("--delay-max", type=int, default=15,
                        help="Maximum delay (seconds) between API applications (default: 15)")
    
    args = parser.parse_args()

    orchestrator = AutoApplyOrchestrator(
        mode=args.mode,
        max_applications=args.max_applications,
        dry_run=args.dry_run,
        delay_min=args.delay_min,
        delay_max=args.delay_max,
    )

    summary = await orchestrator.run()

    # Print summary as JSON for parsing by other tools
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    asyncio.run(main())
