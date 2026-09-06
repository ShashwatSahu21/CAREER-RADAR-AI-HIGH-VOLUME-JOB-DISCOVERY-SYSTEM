import argparse
import asyncio
import logging
import sys
from src.engine import run_job_discovery
from src.notifier import EmailNotifier
from src.weekly_reporter import WeeklyReporter
from src.applier.orchestrator import AutoApplyOrchestrator


# Setup global logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("CareerRadar.Main")

def main():
    parser = argparse.ArgumentParser(description="Career Radar AI Job Search & AutoApply Automation System")
    parser.add_argument(
        "--weekly",
        action="store_true",
        help="Run the weekly analytics report instead of the daily job discovery"
    )
    parser.add_argument(
        "--auto-apply",
        action="store_true",
        default=True,
        help="Automatically apply to discovered relevant jobs (default: True)"
    )
    parser.add_argument(
        "--no-auto-apply",
        dest="auto_apply",
        action="store_false",
        help="Disable automatic application submission"
    )
    parser.add_argument(
        "--apply-mode",
        choices=["api-only", "browser-only", "all"],
        default="all",
        help="Applier mode to use (default: all)"
    )
    parser.add_argument(
        "--max-applications",
        type=int,
        default=50,
        help="Maximum number of daily applications to submit (default: 50)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run AutoApply in dry-run simulation mode without submitting"
    )
    args = parser.parse_args()

    if args.weekly:
        logger.info("Executing Weekly Analytics Flow...")
        success = WeeklyReporter.run_weekly_report()
        if not success:
            logger.error("Weekly Analytics Report failed.")
            sys.exit(1)
    else:
        logger.info("Executing Daily Job Discovery & AutoApply Flow...")
        try:
            # 1. Discover, filter and enqueue matching jobs
            new_jobs, scanned_count = run_job_discovery()
            logger.info(f"Discovery complete. Scanned: {scanned_count}, Found: {len(new_jobs)} new opportunities.")

            auto_apply_summary = None

            # 2. Run AutoApply on the queue
            if args.auto_apply:
                logger.info(f"Triggering AutoApply Engine (Max Applications: {args.max_applications}, Mode: {args.apply_mode})...")
                orchestrator = AutoApplyOrchestrator(
                    mode=args.apply_mode,
                    max_applications=args.max_applications,
                    dry_run=args.dry_run,
                )
                auto_apply_summary = asyncio.run(orchestrator.run())
                logger.info(f"AutoApply execution finished. Applied: {auto_apply_summary.get('applied', 0)}")
            
            # 3. Send daily email notification with AutoApply summary
            if new_jobs or auto_apply_summary:
                success = EmailNotifier.send_email(new_jobs, scanned_count, auto_apply_summary)
                if not success:
                    logger.warning("Email notification was not sent (SMTP might not be configured).")
            else:
                logger.info("No new jobs or apply updates to report.")
        except Exception as e:
            logger.error(f"Error during daily execution: {e}", exc_info=True)
            sys.exit(1)

    logger.info("Execution complete.")

if __name__ == "__main__":
    main()
