from typing import List
from bs4 import BeautifulSoup
from src.collectors.base import BaseCollector
from src.config import GREENHOUSE_COMPANIES
from src.models import Job

class GreenhouseCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Greenhouse")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []

        for company in GREENHOUSE_COMPANIES:
            self.logger.info(f"Scanning Greenhouse board for company: '{company}'")
            url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true"
            
            response = self._make_request(url)
            if not response:
                self.logger.warning(f"Could not fetch data for company: '{company}'")
                continue

            try:
                data = response.json()
                jobs_list = data.get("jobs", [])
                self.logger.info(f"Retrieved {len(jobs_list)} total positions for '{company}'")

                for job_data in jobs_list:
                    job_id = f"greenhouse_{company}_{job_data.get('id')}"
                    title = job_data.get("title", "").strip()
                    apply_link = job_data.get("absolute_url", "").strip()
                    
                    # Parse location
                    location_data = job_data.get("location", {})
                    location = location_data.get("name", "Remote").strip() if location_data else "Remote"

                    # Parse description content to text
                    raw_content = job_data.get("content", "")
                    description = ""
                    if raw_content:
                        soup = BeautifulSoup(raw_content, "html.parser")
                        description = soup.get_text(separator="\n").strip()

                    # Extract short summary (first 250 characters of text)
                    short_summary = "No description provided."
                    if description:
                        # Clean multiple newlines and spaces
                        cleaned_desc = " ".join(description.split())
                        if len(cleaned_desc) > 250:
                            short_summary = cleaned_desc[:247] + "..."
                        else:
                            short_summary = cleaned_desc

                    # Create standard Job object
                    job = Job(
                        job_id=job_id,
                        title=title,
                        company=company.replace("ai", " AI").title().strip(),
                        location=location,
                        experience="N/A",  # Will be extracted or graded in scoring engine
                        source="Greenhouse",
                        apply_link=apply_link,
                        description=description,
                        short_summary=short_summary
                    )
                    discovered_jobs.append(job)

            except Exception as e:
                self.logger.error(f"Error parsing Greenhouse data for '{company}': {e}", exc_info=True)

        return discovered_jobs
