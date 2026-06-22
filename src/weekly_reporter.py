import json
import logging
import os
import smtplib
from collections import Counter
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Any, Tuple

from src.config import (
    SEEN_JOBS_FILE,
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    DESTINATION_EMAIL,
    CATEGORY_A_PRODUCT,
    CATEGORY_B_ROBOTICS,
    CATEGORY_C_SOFTWARE
)

logger = logging.getLogger("CareerRadar.WeeklyReporter")

class WeeklyReporter:
    @staticmethod
    def load_recent_jobs(days: int = 7) -> List[Dict[str, Any]]:
        """Loads jobs sent in the last N days from seen_jobs.json."""
        if not os.path.exists(SEEN_JOBS_FILE):
            logger.warning(f"seen_jobs.json file not found at {SEEN_JOBS_FILE}.")
            return []

        try:
            with open(SEEN_JOBS_FILE, "r") as f:
                data = json.load(f)

            recent_jobs = []
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            for job in data:
                date_str = job.get("date_found", "")
                try:
                    date_found = datetime.strptime(date_str, "%Y-%m-%d")
                    if date_found >= cutoff_date:
                        recent_jobs.append(job)
                except ValueError:
                    continue

            logger.info(f"Loaded {len(recent_jobs)} jobs sent in the last {days} days.")
            return recent_jobs
        except Exception as e:
            logger.error(f"Error loading jobs for weekly report: {e}", exc_info=True)
            return []

    @staticmethod
    def analyze_skills(jobs: List[Dict[str, Any]]) -> List[tuple]:
        """Extracts and counts skill terms in job titles and descriptions."""
        # A curated list of relevant tech skills to look for
        skill_dictionary = [
            "python", "c++", "cpp", "ros2", "ros", "pytorch", "tensorflow",
            "opencv", "slam", "perception", "motion planning", "manipulation",
            "reinforcement learning", "isaac sim", "isaac lab", "jetson",
            "embedded", "computer vision", "lidar", "sensor fusion", "docker",
            "git", "linux", "rtos", "control systems", "simulation", "mlops"
        ]

        skill_counter = Counter()
        for job in jobs:
            text = (job.get("title", "") + " " + job.get("short_summary", "")).lower()
            for skill in skill_dictionary:
                # Use regex with word boundaries to avoid matching sub-words like 'git' inside 'digital'
                import re
                pattern = r"\b" + re.escape(skill) + r"\b"
                if re.search(pattern, text):
                    skill_counter[skill] += 1

        return skill_counter.most_common(10)

    @classmethod
    def generate_report(cls, jobs: List[Dict[str, Any]]) -> Tuple[str, str]:
        """Generates plain text and HTML weekly reports."""
        timestamp = datetime.now().strftime("%Y-%m-%d")
        total_discovered = len(jobs)

        # 1. Most Requested Skills
        top_skills = cls.analyze_skills(jobs)
        skills_str = ", ".join([f"{skill.title()} ({count})" for skill, count in top_skills])

        # 2. Top Hiring Companies
        companies = [job.get("company", "Unknown") for job in jobs]
        top_companies = Counter(companies).most_common(5)
        companies_str = ", ".join([f"{comp} ({count})" for comp, count in top_companies])

        # 3. Top Locations
        locations = [job.get("location", "Remote") for job in jobs]
        top_locations = Counter(locations).most_common(5)
        locations_str = ", ".join([f"{loc} ({count})" for loc, count in top_locations])

        # 4. Most Common Keywords in Titles
        title_words = []
        for job in jobs:
            # Tokenize title into clean lowercase words/phrases
            words = re.findall(r"\b\w+\b", job.get("title", "").lower())
            title_words.extend([w for w in words if len(w) > 2 and w not in ["and", "for", "the", "with", "role"]])
        top_title_keywords = Counter(title_words).most_common(8)
        keywords_str = ", ".join([f"{word} ({count})" for word, count in top_title_keywords])

        # 5. Categorized Openings
        product_jobs = []
        robotics_jobs = []
        software_jobs = []
        remote_jobs = []

        for job in jobs:
            title_lower = job.get("title", "").lower()
            loc_lower = job.get("location", "").lower()
            
            # Product check
            if any(kw.lower() in title_lower for kw in CATEGORY_A_PRODUCT):
                product_jobs.append(job)

            # Robotics check
            if any(kw.lower() in title_lower for kw in CATEGORY_B_ROBOTICS):
                robotics_jobs.append(job)

            # Software check
            if any(kw.lower() in title_lower for kw in CATEGORY_C_SOFTWARE):
                software_jobs.append(job)

            # Remote check
            if any(term in loc_lower for term in ["remote", "wfh", "work from home", "anywhere", "worldwide"]):
                remote_jobs.append(job)

        # 6. Recommended Skills To Learn
        recommended_skills = ["ROS2", "Product Spec Writing", "Python & Backend Frameworks", "SLAM & Computer Vision", "Agile & Product Operations"]
        if top_skills:
            recommended_skills = [skill.title() for skill, _ in top_skills[:5]]

        # Construct Plain Text
        text_report = f"""
====================================================
CAREER RADAR WEEKLY STARTUP ANALYTICS REPORT
====================================================
Date: {timestamp}
Total Opportunities Discovered: {total_discovered}

📈 KEY INSIGHTS
-------------------------------------------
* Top Hiring Startups: {companies_str if top_companies else "N/A"}
* Top Hiring Skills: {skills_str if top_skills else "N/A"}
* Most Common Keywords: {keywords_str if top_title_keywords else "N/A"}
* Top Hiring Locations: {locations_str if top_locations else "N/A"}

📂 CATEGORY BREAKDOWNS
-------------------------------------------
* Product Management & Ops Openings: {len(product_jobs)}
* Robotics & Physical AI Openings: {len(robotics_jobs)}
* Software Engineering SDE Openings: {len(software_jobs)}
* Remote / WFH Opportunities: {len(remote_jobs)}

🧠 RECOMMENDED SKILLS TO LEARN
-------------------------------------------
{chr(10).join([f"- {skill}" for skill in recommended_skills])}

====================================================
END OF WEEKLY REPORT
====================================================
"""

        # Construct HTML
        html_report = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }}
                .container {{ max-width: 650px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }}
                .header {{ background: linear-gradient(135deg, #10b981 0%, #047857 100%); padding: 30px; text-align: center; color: #ffffff; }}
                .header h1 {{ margin: 0; font-size: 24px; }}
                .content {{ padding: 20px; }}
                .metric-card {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-bottom: 20px; }}
                .metric-title {{ font-size: 14px; font-weight: 700; color: #10b981; text-transform: uppercase; margin-bottom: 10px; }}
                .metric-val {{ font-size: 15px; color: #ffffff; line-height: 1.6; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }}
                .bullet-list {{ margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.6; }}
                .footer {{ background-color: #0f172a; padding: 15px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Weekly Startup Career Analytics</h1>
                    <p>Bangalore & Remote Insights Summary ({timestamp})</p>
                </div>
                <div class="content">
                    <div class="metric-card">
                        <div class="metric-title">💡 Summary</div>
                        <div class="metric-val">Discovered <strong>{total_discovered}</strong> startup opportunities this week, optimizing for interview probability and remote/Bangalore setups.</div>
                    </div>
                    
                    <div class="grid">
                        <div class="metric-card">
                            <div class="metric-title">🛠️ Top Skills in Demand</div>
                            <ul class="bullet-list">
                                {"".join([f"<li>{skill.title()} ({count})</li>" for skill, count in top_skills[:5]]) if top_skills else "<li>No data</li>"}
                            </ul>
                        </div>
                        <div class="metric-card">
                            <div class="metric-title">📈 Top Startups Hiring</div>
                            <ul class="bullet-list">
                                {"".join([f"<li>{comp} ({count})</li>" for comp, count in top_companies]) if top_companies else "<li>No data</li>"}
                            </ul>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-title">📂 Openings Breakdown</div>
                        <ul class="bullet-list">
                            <li>💼 Product & PM Internships: <strong>{len(product_jobs)}</strong></li>
                            <li>🤖 Robotics & Physical AI Roles: <strong>{len(robotics_jobs)}</strong></li>
                            <li>💻 Software & SDE Roles: <strong>{len(software_jobs)}</strong></li>
                            <li>🌍 Remote / WFH Placements: <strong>{len(remote_jobs)}</strong></li>
                        </ul>
                    </div>

                    <div class="metric-card">
                        <div class="metric-title">🧠 Recommended Skills to Learn</div>
                        <ol class="bullet-list" style="list-style-type: decimal;">
                            {"".join([f"<li>{skill}</li>" for skill in recommended_skills])}
                        </ol>
                    </div>
                </div>
                <div class="footer">
                    Career Radar AI &bull; Shashwat Sahu Bangalore Startup Portal
                </div>
            </div>
        </body>
        </html>
        """
        return text_report, html_report

    @classmethod
    def run_weekly_report(cls) -> bool:
        """Runs the weekly analysis and emails the report."""
        logger.info("Starting Weekly Analytics Report job...")
        
        # Load jobs from past 7 days
        recent_jobs = cls.load_recent_jobs(days=7)
        if not recent_jobs:
            logger.warning("No recent jobs in database. Skipping weekly report.")
            return True

        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logger.error("SMTP_USERNAME or SMTP_PASSWORD is not set. Cannot send weekly report.")
            return False

        logger.info("Composing weekly report...")
        text_content, html_content = cls.generate_report(recent_jobs)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "📊 Career Radar | Weekly Analytics & Insights Report"
        msg["From"] = SMTP_USERNAME
        msg["To"] = DESTINATION_EMAIL

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            logger.info("Connecting to SMTP server for weekly report...")
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [DESTINATION_EMAIL], msg.as_string())
            server.quit()
            logger.info(f"Weekly Analytics Report sent successfully to {DESTINATION_EMAIL}!")
            return True
        except Exception as e:
            logger.error(f"Failed to send weekly report: {e}", exc_info=True)
            return False

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Simple manual run
    WeeklyReporter.run_weekly_report()
