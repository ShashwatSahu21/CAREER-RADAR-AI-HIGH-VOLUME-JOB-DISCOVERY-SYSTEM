from typing import List
from src.collectors.base import BaseCollector
from src.models import Job

class NaukriCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Naukri")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []
        self.logger.info("Scanning Naukri search API...")
        
        # Naukri's web search API
        url = "https://www.naukri.com/jobapi/v3/search"
        
        # We will query target keywords
        keywords = ["robotics", "physical ai", "software engineer", "sde"]

        for keyword in keywords:
            params = {
                "noOfResults": "30",
                "pageNo": "1",
                "keyword": keyword,
                "urlType": "search_by_key_loc",
                "searchType": "adv"
            }
            
            # Mimic browser headers including the crucial appid and systemid
            headers = {
                "appid": "109",
                "systemid": "Naukri",
                "Referer": "https://www.naukri.com/",
                "Accept": "application/json"
            }

            self.logger.info(f"Querying Naukri API for keyword: '{keyword}'")
            response = self._make_request(url, params=params, headers=headers)
            
            if not response:
                self.logger.warning(
                    f"Could not fetch Naukri search results for '{keyword}'. "
                    f"This is expected if Naukri blocks requests without dynamically generated nkparam signatures."
                )
                continue

            try:
                data = response.json()
                # Naukri v3 response structure stores jobs inside "jobDetails" or "jobs"
                job_details = data.get("jobDetails", []) or data.get("jobs", [])
                self.logger.info(f"Retrieved {len(job_details)} jobs from Naukri for '{keyword}'")

                for job_data in job_details:
                    title = job_data.get("title", "").strip()
                    company = job_data.get("companyName", "").strip()
                    job_id_raw = job_data.get("jobId", "")
                    
                    if not title or not job_id_raw:
                        continue

                    job_id = f"naukri_{job_id_raw}"
                    
                    # Apply Link
                    jd_url = job_data.get("jdURL", "")
                    apply_link = jd_url if jd_url else f"https://www.naukri.com/job-listings-{job_id_raw}"

                    # Parse placeholders for location and experience
                    location = "India"
                    experience = "N/A"
                    placeholders = job_data.get("placeholders", [])
                    for ph in placeholders:
                        ph_type = ph.get("type", "")
                        if ph_type == "location":
                            location = ph.get("label", "India").strip()
                        elif ph_type == "experience":
                            experience = ph.get("label", "0-2 Years").strip()

                    # Retrieve job description
                    description = job_data.get("jobDescription", "") or job_data.get("tagsAndSkills", "")
                    description = description.strip()

                    # Construct short summary
                    short_summary = f"Naukri SDE/Robotics: {title} at {company} ({location}). Experience: {experience}."

                    job = Job(
                        job_id=job_id,
                        title=title,
                        company=company,
                        location=location,
                        experience=experience,
                        source="Naukri",
                        apply_link=apply_link,
                        description=description,
                        short_summary=short_summary
                    )
                    discovered_jobs.append(job)

            except Exception as e:
                self.logger.error(f"Error parsing Naukri API data: {e}", exc_info=True)

        return discovered_jobs
