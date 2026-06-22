from typing import List
from src.collectors.base import BaseCollector
from src.models import Job

class TeslaCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Tesla")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []
        self.logger.info("Scanning Tesla internal careers endpoint...")
        
        # Public careers state URL used by Tesla's website
        url = "https://www.tesla.com/cua-api/apps/careers/state"
        
        response = self._make_request(url)
        if not response:
            self.logger.warning("Could not fetch jobs from Tesla careers state endpoint.")
            return discovered_jobs

        try:
            payload = response.json()
            # Extract nested jobs dictionary
            jobs_dict = payload.get("jobs", {}).get("data", {})
            self.logger.info(f"Retrieved {len(jobs_dict)} total job entities from Tesla API")

            for job_key, job_data in jobs_dict.items():
                job_id = f"tesla_{job_key}"
                title = job_data.get("title", "").strip()
                department = job_data.get("department", "").strip()
                location = job_data.get("location", "Remote").strip()
                
                # Check for standard id
                j_id = job_data.get("id") or job_key
                apply_link = f"https://www.tesla.com/careers/search/job/{j_id}"

                # Tesla description is usually blank or contains basic detail in API
                description = f"Department: {department}. Location: {location}. Job family: {job_data.get('jobFamily', '')}"
                
                # Construct short summary
                short_summary = f"Tesla Opportunity: {title} in {location}. Department: {department}."

                job = Job(
                    job_id=job_id,
                    title=title,
                    company="Tesla",
                    location=location,
                    experience="N/A",
                    source="Tesla API",
                    apply_link=apply_link,
                    description=description,
                    short_summary=short_summary
                )
                discovered_jobs.append(job)

        except Exception as e:
            self.logger.error(f"Error parsing Tesla careers state data: {e}", exc_info=True)

        return discovered_jobs
