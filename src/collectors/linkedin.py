import urllib.parse
from typing import List
from bs4 import BeautifulSoup
from src.collectors.base import BaseCollector
from src.config import TARGET_LOCATIONS
from src.models import Job

class LinkedInCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="LinkedIn")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []
        
        # Combined query to maximize matches in a single request and avoid rate limits
        query_str = 'Robotics OR "Physical AI" OR "Embodied AI" OR ROS2 OR "Computer Vision" OR "Software Engineer" OR "AI Engineer" OR "SDE"'
        encoded_query = urllib.parse.quote(query_str)

        # Loop through target locations
        for location in TARGET_LOCATIONS:
            self.logger.info(f"Searching LinkedIn Guest API in '{location}'")
            
            # Fetch start=0 and start=25 to get the first 50 results
            for start_idx in [0, 25]:
                # f_TPR=r86400 restricts search to the last 24 hours (86400 seconds)
                url = (
                    f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?"
                    f"keywords={encoded_query}&location={urllib.parse.quote(location)}&f_TPR=r86400&start={start_idx}"
                )
                
                # Let's add some randomized delay or handle blocking
                headers = {
                    "Accept": "*/*",
                    "Referer": "https://www.linkedin.com/jobs/search"
                }

                response = self._make_request(url, headers=headers)
                if not response:
                    self.logger.warning(f"Failed to fetch LinkedIn jobs for '{location}' (index {start_idx})")
                    break

                html_content = response.text
                if not html_content or "base-card" not in html_content:
                    # If the page is empty, we reached the end of listings or got blocked
                    self.logger.info(f"No listings found or reached end for '{location}' at index {start_idx}")
                    break

                try:
                    soup = BeautifulSoup(html_content, "html.parser")
                    job_cards = soup.find_all("li")
                    self.logger.info(f"Found {len(job_cards)} job cards in page (start={start_idx}) for '{location}'")

                    for card in job_cards:
                        # Extract job id
                        card_div = card.find("div", class_="base-card")
                        if not card_div:
                            continue

                        raw_job_id = card_div.get("data-entity-urn", "")
                        if not raw_job_id:
                            # Fallback to checking full link or data-id
                            link_elem = card.find("a", class_="base-card__full-link")
                            if link_elem and "href" in link_elem.attrs:
                                # Extract ID from link (e.g. /jobs/view/software-engineer-at-x-123456789)
                                href = link_elem["href"]
                                raw_job_id = href.split("?")[0].split("-")[-1]
                            else:
                                raw_job_id = card_div.get("data-id", "")

                        if not raw_job_id:
                            continue

                        # Clean up job id
                        clean_id = raw_job_id.split(":")[-1] if ":" in raw_job_id else raw_job_id
                        job_id = f"linkedin_{clean_id}"

                        # Extract Title
                        title_elem = card.find("h3", class_="base-search-card__title")
                        title = title_elem.text.strip() if title_elem else "Unknown Role"

                        # Extract Company
                        company_elem = card.find("h4", class_="base-search-card__subtitle")
                        company = "Unknown Company"
                        if company_elem:
                            company_link = company_elem.find("a")
                            company = company_link.text.strip() if company_link else company_elem.text.strip()

                        # Extract Location
                        loc_elem = card.find("span", class_="job-search-card__location")
                        job_location = loc_elem.text.strip() if loc_elem else location

                        # Apply Link
                        apply_link = f"https://www.linkedin.com/jobs/view/{clean_id}"

                        # Create short summary
                        short_summary = f"New listing on LinkedIn by {company} in {job_location}."

                        job = Job(
                            job_id=job_id,
                            title=title,
                            company=company,
                            location=job_location,
                            experience="N/A",  # LinkedIn Guest API does not give description/experience directly in search
                            source="LinkedIn",
                            apply_link=apply_link,
                            description=f"LinkedIn search result. Title: {title}. Company: {company}.",
                            short_summary=short_summary
                        )
                        discovered_jobs.append(job)

                except Exception as e:
                    self.logger.error(f"Error parsing LinkedIn job card: {e}", exc_info=True)

        return discovered_jobs
