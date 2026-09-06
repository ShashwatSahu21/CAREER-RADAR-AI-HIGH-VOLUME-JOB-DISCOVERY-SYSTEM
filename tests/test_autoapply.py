import unittest
import json
import os
from src.applier.base import (
    CandidateProfile,
    ApplicationPackage,
    detect_platform,
)
from src.applier.scheduler import DailyQuotaTracker


class TestAutoApply(unittest.TestCase):
    def test_platform_detection(self):
        self.assertEqual(
            detect_platform("https://boards.greenhouse.io/stripe/jobs/123"),
            "greenhouse_api"
        )
        self.assertEqual(
            detect_platform("https://jobs.lever.co/palantir/abc-123"),
            "lever_api"
        )
        self.assertEqual(
            detect_platform("https://jobs.ashbyhq.com/openai/xyz"),
            "ashby_api"
        )
        self.assertEqual(
            detect_platform("https://www.linkedin.com/jobs/view/999"),
            "linkedin_browser"
        )
        self.assertEqual(
            detect_platform("https://www.naukri.com/job-listings-123"),
            "naukri_browser"
        )
        self.assertEqual(
            detect_platform("https://company.myworkdayjobs.com/careers/job/1"),
            "workday_browser"
        )

    def test_candidate_profile_creation(self):
        sample_data = {
            "fullName": "Shashwat Sahu",
            "email": "shashwat@example.com",
            "phone": "+91 8827999403",
            "location": "Bangalore, India",
            "noticePeriod": "Immediate",
            "expectedCTC": "18 LPA",
            "languagesKnown": '["English", "Hindi"]',
        }
        profile = CandidateProfile.from_db(sample_data)
        self.assertEqual(profile.first_name, "Shashwat")
        self.assertEqual(profile.last_name, "Sahu")
        self.assertEqual(profile.notice_period, "Immediate")
        self.assertEqual(len(profile.languages_known), 2)

    def test_quota_tracker(self):
        tracker = DailyQuotaTracker(file_path="data/test_quota.json")
        remaining = tracker.get_remaining_quota("tier_a_api")
        self.assertGreater(remaining, 0)
        # Cleanup
        if os.path.exists("data/test_quota.json"):
            os.remove("data/test_quota.json")


if __name__ == "__main__":
    unittest.main()
