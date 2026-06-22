import unittest
from src.models import Job
from src.engine import compute_job_score

class TestEngine(unittest.TestCase):
    def test_scoring_physical_ai(self):
        """Checks that Physical AI / Robotics titles score maximum values."""
        job = Job(
            job_id="test_1",
            title="Physical AI Research Intern",
            company="Test Company",
            location="Bengaluru",
            experience="Internship",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 95)
        self.assertEqual(tier, "Tier A")

    def test_scoring_ros2(self):
        """Checks that ROS2 / Perception titles score high values."""
        job = Job(
            job_id="test_2",
            title="ROS2 Robotics Software Engineer",
            company="Test Company",
            location="Remote",
            experience="Associate",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 95)  # Matches "Robotics" keyword which has weight 95
        self.assertEqual(tier, "Tier A")

    def test_scoring_software_engineer(self):
        """Checks SDE scoring."""
        job = Job(
            job_id="test_3",
            title="Software Developer",
            company="Test Company",
            location="India",
            experience="Entry Level",
            source="Test",
            apply_link="http://example.com"
        )
        # Matches "Software Developer" (maps to Software Engineering/Developer)
        score, tier = compute_job_score(job)
        # Check that it matches SDE weights
        self.assertGreaterEqual(score, 80)

    def test_negative_filter_rejection(self):
        """Checks that negative terms trigger immediate score = 0."""
        job = Job(
            job_id="test_4",
            title="STEM Trainer & Robotics Teacher",
            company="Robo School",
            location="India",
            experience="N/A",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 0)
        self.assertEqual(tier, "Rejected")

    def test_senior_experience_rejection(self):
        """Checks that Senior / Lead experience levels are rejected."""
        job = Job(
            job_id="test_5",
            title="Senior Robotics Engineer",
            company="Advanced Bots",
            location="Bengaluru",
            experience="Senior",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 0)
        self.assertEqual(tier, "Rejected")

    def test_description_matching_fallback(self):
        """Checks that keyword matches in description are graded when title has no matches."""
        job = Job(
            job_id="test_6",
            title="Graduate Engineer Trainee",
            company="Generic Corp",
            location="India",
            experience="Trainee",
            source="Test",
            apply_link="http://example.com",
            description="We are looking for a trainee. You will write code in Python and work on computer vision tasks."
        )
        score, tier = compute_job_score(job)
        # Should match python or computer vision inside description with a penalty, but >= 50
        self.assertGreaterEqual(score, 50)
        self.assertIn(tier, ["Tier A", "Tier B", "Tier C"])

    def test_location_filter_rejection(self):
        """Checks that jobs in other specific cities (without remote tags) are rejected."""
        job = Job(
            job_id="test_location_reject",
            title="Robotics Software Engineer",
            company="Advanced Bots",
            location="Hyderabad",
            experience="Internship",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 0)
        self.assertEqual(tier, "Rejected")

    def test_location_filter_acceptance_remote(self):
        """Checks that jobs in other cities are accepted if they specify Remote."""
        job = Job(
            job_id="test_location_accept_remote",
            title="Robotics Software Engineer",
            company="Advanced Bots",
            location="Hyderabad (Remote)",
            experience="Internship",
            source="Test",
            apply_link="http://example.com"
        )
        score, tier = compute_job_score(job)
        self.assertEqual(score, 95)
        self.assertEqual(tier, "Tier A")

if __name__ == "__main__":
    unittest.main()
