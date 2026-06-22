from typing import List
from src.collectors.base import BaseCollector
from src.config import LEVER_COMPANIES
from src.models import Job

class LeverCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Lever")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []

        for company in LEVER_COMPANIES:
            self.logger.info(f"Scanning Lever board for company: '{company}'")
            url = f"https://api.lever.co/v0/postings/{company}"
            
            response = self._make_request(url)
            if not response:
                self.logger.warning(f"Could not fetch data for company: '{company}'")
                continue

            try:
                postings = response.json()
                self.logger.info(f"Retrieved {len(postings)} total positions for '{company}'")

                for post_data in postings:
                    job_id = f"lever_{company}_{post_data.get('id')}"
                    title = post_data.get("title", "").strip()
                    apply_link = post_data.get("hostedUrl", "").strip()
                    
                    # Parse location
                    categories = post_data.get("categories", {})
                    location = categories.get("location", "Remote").strip() if categories else "Remote"

                    # Description plain text
                    description = post_data.get("descriptionPlain", "").strip()
                    
                    # Create short summary
                    short_summary = "No description provided."
                    if description:
                        cleaned_desc = " ".join(description.split())
                        if len(cleaned_desc) > 250:
                            short_summary = cleaned_desc[:247] + "..."
                        else:
                            short_summary = cleaned_desc

                    # Create standard Job object
                    job = Job(
                        job_id=job_id,
                        title=title,
                        company=company.replace("-", " ").title().strip(),
                        location=location,
                        experience="N/A",
                        source="Lever",
                        apply_link=apply_link,
                        description=description,
                        short_summary=short_summary
                    )
                    discovered_jobs.append(job)

            except Exception as e:
                self.logger.error(f"Error parsing Lever data for '{company}': {e}", exc_info=True)

        return discovered_jobs
