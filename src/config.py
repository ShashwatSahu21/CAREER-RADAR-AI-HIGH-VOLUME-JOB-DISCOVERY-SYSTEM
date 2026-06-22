import os
from dotenv import load_dotenv

load_dotenv()

# =====================================================================
# SMTP & Recipient Configuration
# =====================================================================
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "shashwatsahu.contact@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
DESTINATION_EMAIL = os.getenv("DESTINATION_EMAIL", "shashwatsahu.contact@gmail.com")

# =====================================================================
# Database State File Settings
# =====================================================================
SEEN_JOBS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "seen_jobs.json"
)
MAX_DAYS_TO_KEEP = 60  # Prune seen jobs older than this to avoid file bloat

# =====================================================================
# Target Locations for Job Scrapes
# =====================================================================
TARGET_LOCATIONS = [
    "India",
    "United States",
    "Germany",
    "Canada",
    "Switzerland",
    "Netherlands",
    "Sweden",
    "Japan",
    "Singapore",
    "Remote"
]

# =====================================================================
# Target Job Source Lists for ATS Collectors
# =====================================================================
# Greenhouse boards (uses Greenhouse public job API)
GREENHOUSE_COMPANIES = [
    "figureai",
    "skildai",
    "apptronik",
    "intrinsic",
    "agilityrobotics",
    "sanctuaryai",
    "covariant"
]

# Lever company slugs (uses Lever public job postings API)
LEVER_COMPANIES = [
    "ghostrobotics",
    "torc-robotics"
]

# Ashby company board IDs
ASHBY_COMPANIES = [
    "reflexrobotics"
]

# Workday endpoints: list of (company_id, board_id, wd_number)
# e.g., for Boston Dynamics: company=bostondynamics, board=BostonDynamics, wd_num=1
WORKDAY_COMPANIES = [
    ("bostondynamics", "BostonDynamics", 1),
    ("kuka", "KUKA", 1),
    ("teradyne", "Teradyne_Careers", 1)  # Teradyne owns Universal Robots
]

# =====================================================================
# Keywords & Scoring Configuration
# =====================================================================

# Categories of positive keywords for classification & metrics
CATEGORY_A_ROBOTICS = [
    "Physical AI", "Embodied AI", "Robot Learning", "Robotics Engineer",
    "Robotics Software Engineer", "Robotics Intern", "ROS2", "Computer Vision",
    "Perception", "SLAM", "Motion Planning", "Manipulation", "Robot Software",
    "Autonomous Systems", "Reinforcement Learning", "Isaac Sim", "Isaac Lab",
    "Jetson", "Embedded AI", "Sensor Fusion"
]

CATEGORY_B_SOFTWARE = [
    "Software Engineer", "Software Developer", "Backend Engineer",
    "Backend Developer", "Python Developer", "AI Engineer", "ML Engineer",
    "Machine Learning Engineer", "SDE", "Associate Engineer",
    "Graduate Engineer", "Trainee Engineer"
]

CATEGORY_C_PRODUCT = [
    "Founder's Office", "Technical Product", "Product Intern",
    "Associate Product Manager", "Technical Consultant", "Solutions Engineer",
    "Program Management"
]

# Specific Keyword Weights for Scoring
KEYWORD_WEIGHTS = {
    "physical ai": 100,
    "embodied ai": 100,
    "robotics": 100,
    "ros2": 95,
    "computer vision": 95,
    "slam": 95,
    "perception": 95,
    "autonomous systems": 95,
    "motion planning": 95,
    "software engineering": 90,
    "software engineer": 90,
    "software developer": 90,
    "developer": 90,
    "sde": 90,
    "python": 90,
    "ai engineering": 85,
    "ai engineer": 85,
    "machine learning": 85,
    "ml engineer": 85,
    "technical consultant": 75,
    "solutions engineer": 75,
    "technical product": 70,
    "product manager": 70,
    "founder's office": 70,
    "marketing": 20,
    "teaching": 0
}

# Automatically reject jobs with these strings in the title (case-insensitive)
NEGATIVE_FILTERS = [
    "teacher", "trainer", "stem trainer", "school instructor", "faculty",
    "telecaller", "insurance sales", "field sales", "bpo", "call center",
    "data entry", "customer support", "generic marketing roles", "non-tech sales",
    "tutor", "professor", "sales executive", "customer service"
]

# Filters for Target Experience Levels (Internships, Entry level, 0-2 yrs)
# If a title contains positive experience keywords, we prioritize it.
# If a title contains negative experience keywords (Senior, Lead, Principal, etc.), we exclude it.
POSITIVE_EXPERIENCE_KEYWORDS = [
    "intern", "graduate", "associate", "trainee", "entry level", "entry-level",
    "junior", "fresh", "0-2 years", "0-1 years", "1-2 years", "3rd year", "4th year"
]

NEGATIVE_EXPERIENCE_KEYWORDS = [
    "senior", "sr", "lead", "principal", "staff", "manager", "director", "vp",
    "head", "architect", "5+ years", "8+ years", "10+ years", "3+ years"
]

# Score Tiers
TIER_A_MIN = 80
TIER_B_MIN = 65
TIER_C_MIN = 50
