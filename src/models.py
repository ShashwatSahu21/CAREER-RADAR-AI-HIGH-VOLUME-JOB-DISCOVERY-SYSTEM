from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any

@dataclass
class Job:
    job_id: str
    title: str
    company: str
    location: str
    experience: str
    source: str
    apply_link: str
    description: str = ""
    score: int = 0
    tier: str = "Tier C"
    date_found: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    short_summary: str = "No description provided."

    def to_dict(self) -> Dict[str, Any]:
        """Convert the Job object to a dictionary for JSON storage."""
        return {
            "job_id": self.job_id,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "experience": self.experience,
            "source": self.source,
            "apply_link": self.apply_link,
            "score": self.score,
            "tier": self.tier,
            "date_found": self.date_found,
            "short_summary": self.short_summary
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Job":
        """Create a Job object from a dictionary representation."""
        return cls(
            job_id=data.get("job_id", ""),
            title=data.get("title", ""),
            company=data.get("company", ""),
            location=data.get("location", ""),
            experience=data.get("experience", "N/A"),
            source=data.get("source", ""),
            apply_link=data.get("apply_link", ""),
            description=data.get("description", ""),
            score=data.get("score", 0),
            tier=data.get("tier", "Tier C"),
            date_found=data.get("date_found", datetime.now().strftime("%Y-%m-%d")),
            short_summary=data.get("short_summary", "No description provided.")
        )
