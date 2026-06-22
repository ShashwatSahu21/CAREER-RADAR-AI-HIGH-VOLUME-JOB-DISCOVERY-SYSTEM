from typing import List
from src.collectors.base import BaseCollector
from src.config import ASHBY_COMPANIES
from src.models import Job

class AshbyCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Ashby")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []

        for company in ASHBY_COMPANIES:
            self.logger.info(f"Scanning Ashby board for company: '{company}'")
            url = f"https://api.ashbyhq.com/posting-api/job-board/{company}"
            
            response = self._make_request(url)
            if not response:
                self.logger.warning(f"Could not fetch data for company: '{company}'")
                continue

            try:
                data = response.json()
                jobs_list = data.get("jobs", [])
                self.logger.info(f"Retrieved {len(jobs_list)} total positions for '{company}'")

                for job_data in jobs_list:
                    # Construct job id
                    raw_id = job_data.get("id") or job_data.get("title", "") + job_data.get("location", "")
                    # Strip spaces/special chars from id
                    clean_id = "".join(c for c in str(raw_id) if c.isalnum())
                    job_id = f"ashby_{company}_{clean_id}"

                    title = job_data.get("title", "").strip()
                    
                    # Direct link on Ashby careers or apply page
                    apply_link = job_data.get("jobUrl") or job_data.get("applyUrl") or f"https://jobs.ashbyhq.com/{company}"
                    apply_link = apply_link.strip()

                    location = job_data.get("location", "Remote").strip()

                    # Retrieve description
                    description = job_data.get("descriptionPlain", "") or job_data.get("descriptionHtml", "")
                    description = description.strip()

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
                        source="Ashby",
                        apply_link=apply_link,
                        description=description,
                        short_summary=short_summary
                    )
                    discovered_jobs.append(job)

            except Exception as e:
                self.logger.error(f"Error parsing Ashby data for '{company}': {e}", exc_info=True)

        return discovered_jobs
