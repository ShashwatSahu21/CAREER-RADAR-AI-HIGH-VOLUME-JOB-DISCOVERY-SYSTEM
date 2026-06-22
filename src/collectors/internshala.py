import urllib.parse
from typing import List
from bs4 import BeautifulSoup
from src.collectors.base import BaseCollector
from src.models import Job

class InternshalaCollector(BaseCollector):
    def __init__(self):
        super().__init__(name="Internshala")

    def collect(self) -> List[Job]:
        discovered_jobs: List[Job] = []
        
        # Keywords to search specifically on Internshala
        keywords = ["robotics", "computer-vision", "software-engineer", "python"]

        for keyword in keywords:
            # We scrape both Internships and fresher Jobs on Internshala
            for category_path in ["internships", "jobs"]:
                self.logger.info(f"Scanning Internshala {category_path} for keyword: '{keyword}'")
                url = f"https://internshala.com/{category_path}/keywords-{urllib.parse.quote(keyword)}"

                response = self._make_request(url)
                if not response:
                    self.logger.warning(f"Could not fetch Internshala page for '{keyword}' ({category_path})")
                    continue

                try:
                    soup = BeautifulSoup(response.text, "html.parser")
                    # Locate job card containers
                    cards = soup.find_all("div", class_="individual_internship")
                    self.logger.info(f"Found {len(cards)} listings for '{keyword}' on Internshala {category_path}")

                    for card in cards:
                        # Extract title/profile
                        profile_div = card.find("div", class_="profile")
                        title = ""
                        if profile_div:
                            title_a = profile_div.find("a")
                            title = title_a.text.strip() if title_a else profile_div.text.strip()
                        else:
                            # Fallback search inside heading tags
                            h3_elem = card.find("h3")
                            if h3_elem:
                                title = h3_elem.text.strip()

                        if not title:
                            continue

                        # Extract Company Name
                        company_div = card.find("div", class_="company_name")
                        company = "Unknown Company"
                        if company_div:
                            company_a = company_div.find("a")
                            company = company_a.text.strip() if company_a else company_div.text.strip()

                        # Extract Location
                        loc_span = card.find("span", class_="location") or card.find("a", class_="location_link")
                        location = loc_span.text.strip() if loc_span else "India"

                        # Extract Apply Link
                        apply_link = ""
                        detail_btn = card.find("a", class_="view_detail_button") or card.find("a", href=True)
                        if detail_btn and "href" in detail_btn.attrs:
                            href = detail_btn["href"]
                            if href.startswith("/"):
                                apply_link = f"https://internshala.com{href}"
                            else:
                                apply_link = href

                        if not apply_link:
                            continue

                        # Generate a clean job id
                        raw_id = apply_link.split("/")[-1].split("?")[0]
                        job_id = f"internshala_{category_path}_{raw_id}"

                        # Extract details like stipend or duration for description
                        other_details = []
                        stipend_span = card.find("span", class_="stipend")
                        if stipend_span:
                            other_details.append(f"Stipend/Salary: {stipend_span.text.strip()}")

                        duration_span = card.find("div", class_="duration")
                        if duration_span:
                            other_details.append(f"Duration: {duration_span.text.strip()}")

                        description = f"Internshala listing. Title: {title}. Company: {company}. Details: " + ", ".join(other_details)
                        short_summary = f"Internshala {category_path[:-1].title()}: {title} at {company} ({location}). " + ", ".join(other_details)

                        job = Job(
                            job_id=job_id,
                            title=title,
                            company=company,
                            location=location,
                            experience="Internship" if category_path == "internships" else "Entry Level",
                            source="Internshala",
                            apply_link=apply_link,
                            description=description,
                            short_summary=short_summary
                        )
                        discovered_jobs.append(job)

                except Exception as e:
                    self.logger.error(f"Error parsing Internshala data for '{keyword}': {e}", exc_info=True)

        return discovered_jobs
