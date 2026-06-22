import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
import logging
from typing import List

from src.config import (
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    DESTINATION_EMAIL
)
from src.models import Job

logger = logging.getLogger("CareerRadar.Notifier")

class EmailNotifier:
    @staticmethod
    def generate_plain_text_report(jobs: List[Job], scanned_count: int) -> str:
        """Generates a structured plain text version of the job report."""
        timestamp = datetime.now().strftime("%Y-%m-%d %I:%M %p")
        new_count = len(jobs)
        
        report = []
        report.append("====================================================")
        report.append("CAREER RADAR REPORT")
        report.append(f"Date: {timestamp}")
        report.append(f"Jobs Scanned: {scanned_count}")
        report.append(f"New Jobs: {new_count}")
        report.append("====================================================\n")

        # Group jobs by tier
        tier_a = [j for j in jobs if j.tier == "Tier A"]
        tier_b = [j for j in jobs if j.tier == "Tier B"]
        tier_c = [j for j in jobs if j.tier == "Tier C"]

        if tier_a:
            report.append("🔥 TIER A (Score > 80)")
            report.append("--------------------")
            for job in tier_a:
                report.append(f"Role: {job.title}")
                report.append(f"Company: {job.company}")
                report.append(f"Location: {job.location}")
                report.append(f"Experience: {job.experience}")
                report.append(f"Source: {job.source}")
                report.append(f"Apply Link: {job.apply_link}")
                report.append(f"Short Summary: {job.short_summary}")
                report.append("---")
            report.append("")

        if tier_b:
            report.append("⭐ TIER B (Score 65-80)")
            report.append("---------------------")
            for job in tier_b:
                report.append(f"Role: {job.title}")
                report.append(f"Company: {job.company}")
                report.append(f"Location: {job.location}")
                report.append(f"Experience: {job.experience}")
                report.append(f"Source: {job.source}")
                report.append(f"Apply Link: {job.apply_link}")
                report.append(f"Short Summary: {job.short_summary}")
                report.append("---")
            report.append("")

        if tier_c:
            report.append("📌 TIER C (Score 50-65)")
            report.append("---------------------")
            for job in tier_c:
                report.append(f"Role: {job.title}")
                report.append(f"Company: {job.company}")
                report.append(f"Location: {job.location}")
                report.append(f"Experience: {job.experience}")
                report.append(f"Source: {job.source}")
                report.append(f"Apply Link: {job.apply_link}")
                report.append(f"Short Summary: {job.short_summary}")
                report.append("---")
            report.append("")

        report.append("====================================================")
        report.append("END OF REPORT")
        report.append("====================================================")
        return "\n".join(report)

    @staticmethod
    def generate_html_report(jobs: List[Job], scanned_count: int) -> str:
        """Generates a highly polished premium HTML version of the job report."""
        timestamp = datetime.now().strftime("%Y-%m-%d %I:%M %p")
        new_count = len(jobs)

        tier_a = [j for j in jobs if j.tier == "Tier A"]
        tier_b = [j for j in jobs if j.tier == "Tier B"]
        tier_c = [j for j in jobs if j.tier == "Tier C"]

        # Helper function to generate cards html
        def build_cards_html(jobs_list: List[Job], tier_class: str) -> str:
            cards = []
            for j in jobs_list:
                card = f"""
                <div class="job-card {tier_class}">
                    <div class="job-header">
                        <span class="job-title">{j.title}</span>
                        <span class="job-score">Score: {j.score}</span>
                    </div>
                    <div class="job-company">{j.company}</div>
                    <div class="job-meta">
                        <span>📍 {j.location}</span> &bull; 
                        <span>💼 {j.experience}</span> &bull; 
                        <span>🌐 {j.source}</span>
                    </div>
                    <div class="job-summary">{j.short_summary}</div>
                    <div style="margin-top: 15px; text-align: right;">
                        <a class="apply-btn" href="{j.apply_link}" target="_blank">Quick Apply &rarr;</a>
                    </div>
                </div>
                """
                cards.append(card)
            return "\n".join(cards)

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background-color: #0f172a;
                    color: #e2e8f0;
                    margin: 0;
                    padding: 20px;
                }}
                .container {{
                    max-width: 650px;
                    margin: 0 auto;
                    background-color: #1e293b;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
                }}
                .header {{
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    padding: 30px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 24px;
                    color: #ffffff;
                    font-weight: 700;
                    letter-spacing: -0.025em;
                }}
                .header p {{
                    margin: 5px 0 0 0;
                    color: #bfdbfe;
                    font-size: 14px;
                }}
                .stats-container {{
                    display: flex;
                    justify-content: space-around;
                    background-color: #0f172a;
                    margin: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #334155;
                }}
                .stat-box {{
                    text-align: center;
                }}
                .stat-value {{
                    font-size: 20px;
                    font-weight: 700;
                    color: #3b82f6;
                }}
                .stat-label {{
                    font-size: 11px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    margin-top: 3px;
                }}
                .section-title {{
                    font-size: 18px;
                    font-weight: 600;
                    margin: 30px 20px 15px 20px;
                    padding-bottom: 5px;
                    border-bottom: 2px solid #334155;
                    display: flex;
                    align-items: center;
                }}
                .job-card {{
                    background-color: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 0 20px 15px 20px;
                    transition: border-color 0.2s;
                }}
                .job-card.tier-a {{
                    border-left: 4px solid #ef4444;
                }}
                .job-card.tier-b {{
                    border-left: 4px solid #f59e0b;
                }}
                .job-card.tier-c {{
                    border-left: 4px solid #10b981;
                }}
                .job-header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                }}
                .job-title {{
                    font-size: 16px;
                    font-weight: 700;
                    color: #ffffff;
                }}
                .job-score {{
                    font-size: 12px;
                    font-weight: 600;
                    color: #94a3b8;
                    background-color: #0f172a;
                    padding: 2px 8px;
                    border-radius: 12px;
                }}
                .job-company {{
                    font-size: 14px;
                    font-weight: 500;
                    color: #3b82f6;
                    margin-top: 4px;
                }}
                .job-meta {{
                    font-size: 12px;
                    color: #94a3b8;
                    margin: 8px 0;
                }}
                .job-summary {{
                    font-size: 13px;
                    color: #cbd5e1;
                    line-height: 1.5;
                }}
                .apply-btn {{
                    display: inline-block;
                    background-color: #3b82f6;
                    color: #ffffff;
                    text-decoration: none;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 8px 16px;
                    border-radius: 6px;
                    transition: background-color 0.2s;
                }}
                .apply-btn:hover {{
                    background-color: #2563eb;
                }}
                .footer {{
                    background-color: #0f172a;
                    padding: 20px;
                    text-align: center;
                    font-size: 11px;
                    color: #64748b;
                    border-top: 1px solid #334155;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Career Radar</h1>
                    <p>Job Search Discovery Engine</p>
                </div>
                
                <div class="stats-container">
                    <div class="stat-box">
                        <div class="stat-value">{timestamp.split()[0]}</div>
                        <div class="stat-label">Report Date</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">{scanned_count}</div>
                        <div class="stat-label">Jobs Scanned</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: #10b981;">{new_count}</div>
                        <div class="stat-label">New Matches</div>
                    </div>
                </div>

                {f'<div class="section-title">🔥 Tier A (Highly Relevant)</div>' + build_cards_html(tier_a, "tier-a") if tier_a else ""}
                {f'<div class="section-title">⭐ Tier B (Good Matches)</div>' + build_cards_html(tier_b, "tier-b") if tier_b else ""}
                {f'<div class="section-title">📌 Tier C (Secondary Matches)</div>' + build_cards_html(tier_c, "tier-c") if tier_c else ""}
                
                <div class="footer">
                    Sent automatically by Career Radar AI. Keep discovering, Shashwat!<br>
                    Physical AI &bull; Robotics &bull; Software Engineering
                </div>
            </div>
        </body>
        </html>
        """
        return html_body

    @classmethod
    def send_email(cls, jobs: List[Job], scanned_count: int) -> bool:
        """Sends the daily report email containing discovered jobs."""
        if not jobs:
            logger.info("No new jobs to report. Skipping email notification.")
            return True

        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logger.error("SMTP_USERNAME or SMTP_PASSWORD is not set. Cannot send email report.")
            return False

        logger.info(f"Preparing email report for {len(jobs)} jobs...")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🚀 Career Radar | {len(jobs)} New Opportunities Found"
        msg["From"] = SMTP_USERNAME
        msg["To"] = DESTINATION_EMAIL

        # Generate report formats
        text_content = cls.generate_plain_text_report(jobs, scanned_count)
        html_content = cls.generate_html_report(jobs, scanned_count)

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            # Connect and send
            logger.info(f"Connecting to SMTP Server {SMTP_SERVER}:{SMTP_PORT}...")
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, [DESTINATION_EMAIL], msg.as_string())
            server.quit()
            logger.info(f"Daily Job Discovery Email report sent successfully to {DESTINATION_EMAIL}!")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}", exc_info=True)
            return False
