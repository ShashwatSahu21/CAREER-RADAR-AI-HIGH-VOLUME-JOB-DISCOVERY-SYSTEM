from typing import List
from src.collectors.base import BaseCollector
from src.config import WORKDAY_COMPANIES
from src.models import Job

class WorkdayCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Workday")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []

        for company_id, board_id, wd_number in WORKDAY_COMPANIES:
            self.logger.info(f"Scanning Workday board for company: '{company_id}' (Board: '{board_id}')")
            url = f"https://{company_id}.wd{wd_number}.myworkdayjobs.com/wday/cxs/{company_id}/{board_id}/jobs"
            
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            json_body = {
                "appliedFacets": {},
                "limit": 50,
                "offset": 0,
                "searchText": ""
            }

            response = self._make_request(
                url=url,
                method="POST",
                json_data=json_body,
                headers=headers
            )
            
            if not response:
                self.logger.warning(f"Could not fetch workday jobs for: '{company_id}'")
                continue

            try:
                data = response.json()
                postings = data.get("jobPostings", [])
                self.logger.info(f"Retrieved {len(postings)} total positions for Workday '{company_id}'")

                for post in postings:
                    title = post.get("title", "").strip()
                    external_path = post.get("externalPath", "")
                    
                    if not external_path:
                        continue

                    # Construct apply link
                    apply_link = f"https://{company_id}.wd{wd_number}.myworkdayjobs.com/{board_id}{external_path}"
                    
                    # Generate a clean job id
                    clean_path = "".join(c for c in external_path if c.isalnum())
                    job_id = f"workday_{company_id}_{clean_path}"

                    location = post.get("locationsText", "Remote").strip()

                    # Workday index API does not give full description in search list,
                    # but it returns bulletFields and other brief items. We will use title matching for scoring.
                    bullet_fields = post.get("bulletFields", [])
                    description = f"Workday Posting. Company: {company_id.title()}. Details: " + ", ".join(bullet_fields)
                    
                    # Construct short summary
                    short_summary = f"Job opportunity at {company_id.title()} in {location}. Details: " + ", ".join(bullet_fields)

                    job = Job(
                        job_id=job_id,
                        title=title,
                        company=company_id.replace("dynamics", " Dynamics").title().strip(),
                        location=location,
                        experience="N/A",
                        source="Workday",
                        apply_link=apply_link,
                        description=description,
                        short_summary=short_summary
                    )
                    discovered_jobs.append(job)

            except Exception as e:
                self.logger.error(f"Error parsing Workday data for '{company_id}': {e}", exc_info=True)

        return discovered_jobs
