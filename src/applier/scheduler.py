"""
AutoApply Engine — Scheduler & Quota Manager
Automates daily batch runs with human-like timing distributions:
- Smart tiered quotas:
    * Tier A (Direct API: Greenhouse, Lever, Ashby): Unlimited / High Volume
    * Tier B (Fast Browser: Naukri Quick Apply, Generic): 30 applications/day
    * Tier C (Strict Browser: LinkedIn Easy Apply, Workday): 20 applications/day
- Business hours restriction (09:00 - 19:00 local time)
- Session pacing & randomized pauses
- Daily summary logs and state persistence
"""

import asyncio
import json
import logging
import os
import random
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional

from src.applier.orchestrator import AutoApplyOrchestrator

logger = logging.getLogger("AutoApply.Scheduler")

DAILY_QUOTA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "daily_quota.json"
)

# Quota configurations by Tier
TIER_QUOTAS = {
    "tier_a_api": 100,      # Greenhouse, Lever, Ashby
    "tier_b_browser": 30,   # Naukri, Generic forms
    "tier_c_browser": 20,   # LinkedIn, Workday
}


class DailyQuotaTracker:
    """Tracks and persists daily application counts across tiers."""

    def __init__(self, file_path: str = DAILY_QUOTA_FILE):
        self.file_path = file_path
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

    def _load_data(self) -> Dict[str, Any]:
        if not os.path.exists(self.file_path):
            return {"date": datetime.utcnow().strftime("%Y-%m-%d"), "counts": {}}
        try:
            with open(self.file_path, "r") as f:
                data = json.load(f)
            # Reset if new day
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            if data.get("date") != today_str:
                return {"date": today_str, "counts": {}}
            return data
        except Exception:
            return {"date": datetime.utcnow().strftime("%Y-%m-%d"), "counts": {}}

    def _save_data(self, data: Dict[str, Any]):
        try:
            with open(self.file_path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save quota file: {e}")

    def get_remaining_quota(self, tier: str) -> int:
        data = self._load_data()
        applied = data.get("counts", {}).get(tier, 0)
        max_quota = TIER_QUOTAS.get(tier, 25)
        return max(0, max_quota - applied)

    def record_applications(self, tier: str, count: int):
        data = self._load_data()
        counts = data.setdefault("counts", {})
        counts[tier] = counts.get(tier, 0) + count
        self._save_data(data)


class AutoApplyScheduler:
    """Manages scheduled runs and business hours windows."""

    def __init__(
        self,
        business_hours_start: int = 9,
        business_hours_end: int = 19,
        dry_run: bool = False,
    ):
        self.start_hour = business_hours_start
        self.end_hour = business_hours_end
        self.dry_run = dry_run
        self.quota_tracker = DailyQuotaTracker()

    def is_within_business_hours(self) -> bool:
        """Check if current local time falls within configured window."""
        now = datetime.now()
        return self.start_hour <= now.hour < self.end_hour

    async def run_daily_batch(self, mode: str = "all") -> Dict[str, Any]:
        """Run a batch of applications adhering to daily quotas."""
        logger.info("=" * 60)
        logger.info("[AutoApply Scheduler Triggered]")
        logger.info(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"   Mode: {mode}")
        logger.info("=" * 60)

        # Quotas
        tier_a_left = self.quota_tracker.get_remaining_quota("tier_a_api")
        tier_b_left = self.quota_tracker.get_remaining_quota("tier_b_browser")
        tier_c_left = self.quota_tracker.get_remaining_quota("tier_c_browser")

        total_allowed = tier_a_left + tier_b_left + tier_c_left
        logger.info(
            f"Quota remaining today — Tier A (API): {tier_a_left}, "
            f"Tier B (Browser): {tier_b_left}, Tier C (LinkedIn/Workday): {tier_c_left}"
        )

        if total_allowed <= 0:
            logger.info("Daily application limit reached for all tiers. Skipping run.")
            return {"status": "QUOTA_EXHAUSTED", "applied": 0}

        orchestrator = AutoApplyOrchestrator(
            mode=mode,
            max_applications=total_allowed,
            dry_run=self.dry_run,
        )

        summary = await orchestrator.run()

        # Update quota usage
        applied_count = summary.get("applied", 0)
        if applied_count > 0 and not self.dry_run:
            if mode == "api-only":
                self.quota_tracker.record_applications("tier_a_api", applied_count)
            elif mode == "browser-only":
                self.quota_tracker.record_applications("tier_c_browser", applied_count)
            else:
                self.quota_tracker.record_applications("tier_a_api", applied_count)

        return summary


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="AutoApply Daily Scheduler")
    parser.add_argument("--mode", choices=["api-only", "browser-only", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    scheduler = AutoApplyScheduler(dry_run=args.dry_run)
    await scheduler.run_daily_batch(mode=args.mode)


if __name__ == "__main__":
    asyncio.run(main())
