import argparse
import logging
import sys
from src.engine import run_job_discovery
from src.notifier import EmailNotifier
from src.weekly_reporter import WeeklyReporter

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
    parser = argparse.ArgumentParser(description="Career Radar AI Job Search Automation System")
    parser.add_argument(
        "--weekly",
        action="store_true",
        help="Run the weekly analytics report instead of the daily job discovery"
    )
    args = parser.parse_args()

    if args.weekly:
        logger.info("Executing Weekly Analytics Flow...")
        success = WeeklyReporter.run_weekly_report()
        if not success:
            logger.error("Weekly Analytics Report failed.")
            sys.exit(1)
    else:
        logger.info("Executing Daily Job Discovery Flow...")
        try:
            new_jobs, scanned_count = run_job_discovery()
            logger.info(f"Discovery complete. Scanned: {scanned_count}, Found: {len(new_jobs)} new opportunities.")
            
            # Send daily email notification
            if new_jobs:
                success = EmailNotifier.send_email(new_jobs, scanned_count)
                if not success:
                    logger.error("Failed to send daily email report.")
                    sys.exit(1)
            else:
                logger.info("No new jobs found. Skipping email notification.")
        except Exception as e:
            logger.error(f"Error during daily execution: {e}", exc_info=True)
            sys.exit(1)

    logger.info("Execution complete.")

if __name__ == "__main__":
    main()
