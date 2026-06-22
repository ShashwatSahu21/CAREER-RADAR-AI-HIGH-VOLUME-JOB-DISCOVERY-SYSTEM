import os
from dotenv import load_dotenv

load_dotenv()

# =====================================================================
# SMTP & Recipient Configuration
# =====================================================================
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# Defensively handle empty environment strings from GitHub Secrets
username_env = os.getenv("SMTP_USERNAME", "")
SMTP_USERNAME = username_env if username_env.strip() else "shashwatsahu.contact@gmail.com"

SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

dest_env = os.getenv("DESTINATION_EMAIL", "")
DESTINATION_EMAIL = dest_env if dest_env.strip() else "shashwatsahu.contact@gmail.com"

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
# Optimized for Bangalore and Remote India, ignoring other specific regions
TARGET_LOCATIONS = [
    "Bangalore",
    "Bengaluru",
    "India",
    "Remote"
]

# =====================================================================
# Target Job Source Lists for ATS Collectors
# =====================================================================
# Greenhouse boards (uses Greenhouse public job API)
GREENHOUSE_COMPANIES = [
    # Global Robotics / Embodied AI
    "figureai",
    "skildai",
    "apptronik",
    "intrinsic",
    "agilityrobotics",
    "sanctuaryai",
    "covariant",
    # India Tech Startups / Product / Robotics
    "razorpay",
    "groww",
    "postman",
    "locusrobotics",
    "observeai",
    "sprinto",
    "whatfix",
    "unacademy",
    "yellowai"
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

# Categories of positive keywords for weekly metrics
CATEGORY_A_PRODUCT = [
    "Product Intern", "Associate Product Manager", "Technical Product",
    "Product Operations", "Program Management", "Founder's Office",
    "Business Operations", "Startup Generalist", "Product Analyst"
]

CATEGORY_B_ROBOTICS = [
    "Robotics Intern", "Robotics Software", "ROS2", "Physical AI",
    "Embodied AI", "Autonomous Systems", "Robot Perception",
    "Industrial Automation", "Computer Vision for Robotics",
    "Automation Engineer", "Mechatronics"
]

CATEGORY_C_SOFTWARE = [
    "Software Engineer", "Software Developer", "Backend Engineer",
    "Backend Developer", "Python Developer", "SDE", "Associate Engineer",
    "Graduate Engineer", "Trainee Engineer"
]

CATEGORY_D_AI = [
    "AI Intern", "Machine Learning", "Computer Vision", "Data Engineer",
    "Applied AI"
]

CATEGORY_E_TECHNICAL_CLIENT = [
    "Technical Consultant", "Solutions Engineer", "Technical Account",
    "Pre-Sales Engineer"
]

# Specific Keyword Weights for Scoring
KEYWORD_WEIGHTS = {
    # Priority 1 (Weight 100)
    "product": 100,
    "founder's office": 100,
    "apm": 100,
    "associate product manager": 100,
    "startup generalist": 100,
    
    # Priority 2 (Weight 95)
    "program management": 95,
    "program manager": 95,
    "robotics": 95,
    "physical ai": 95,
    "embodied ai": 95,
    "mechatronics": 95,
    "autonomous systems": 95,
    
    # Priority 3 (Weight 90)
    "ros2": 90,
    "computer vision": 90,
    "software engineering": 90,
    "software engineer": 90,
    "software developer": 90,
    "developer": 90,
    "sde": 90,
    "backend": 90,
    
    # Priority 4 (Weight 80)
    "python": 85,
    "ai": 80,
    "machine learning": 80,
    "ml": 80,
    "data engineer": 80,
    
    # Priority 5 (Weight 70)
    "technical consulting": 70,
    "technical consultant": 70,
    "solutions engineer": 70,
    "pre-sales": 70,
    
    # Exclude
    "marketing": 20,
    "teaching": 0
}

# Automatically reject jobs with these strings in the title (case-insensitive)
NEGATIVE_FILTERS = [
    "teacher", "trainer", "stem trainer", "school instructor", "faculty",
    "telecaller", "insurance sales", "field sales", "bpo", "call center",
    "customer support", "customer service", "data entry", "tutor", "professor",
    "sales executive", "non-tech marketing", "non-tech sales"
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
