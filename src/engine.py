import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

from src.config import (
    SEEN_JOBS_FILE,
    MAX_DAYS_TO_KEEP,
    KEYWORD_WEIGHTS,
    NEGATIVE_FILTERS,
    NEGATIVE_EXPERIENCE_KEYWORDS,
    POSITIVE_EXPERIENCE_KEYWORDS,
    TIER_A_MIN,
    TIER_B_MIN,
    TIER_C_MIN
)
from src.models import Job

# Collectors
from src.collectors.greenhouse import GreenhouseCollector
from src.collectors.lever import LeverCollector
from src.collectors.ashby import AshbyCollector
from src.collectors.workday import WorkdayCollector
from src.collectors.tesla import TeslaCollector
from src.collectors.linkedin import LinkedInCollector
from src.collectors.naukri import NaukriCollector
from src.collectors.internshala import InternshalaCollector

logger = logging.getLogger("CareerRadar.Engine")

# =====================================================================
# State & Database Management
# =====================================================================

def load_seen_jobs() -> Dict[str, Dict[str, Any]]:
    """Loads the database of already processed jobs."""
    if not os.path.exists(SEEN_JOBS_FILE):
        # Ensure directories exist
        os.makedirs(os.path.dirname(SEEN_JOBS_FILE), exist_ok=True)
        with open(SEEN_JOBS_FILE, "w") as f:
            json.dump([], f)
        return {}

    try:
        with open(SEEN_JOBS_FILE, "r") as f:
            data = json.load(f)
            # Convert list back to dictionary keyed by job_id
            return {job["job_id"]: job for job in data}
    except Exception as e:
        logger.error(f"Error loading seen_jobs.json: {e}", exc_info=True)
        return {}

def save_seen_jobs(seen_jobs: Dict[str, Dict[str, Any]]):
    """Saves the database of processed jobs to file."""
    try:
        # Convert dictionary to list of values
        data_list = list(seen_jobs.values())
        os.makedirs(os.path.dirname(SEEN_JOBS_FILE), exist_ok=True)
        with open(SEEN_JOBS_FILE, "w") as f:
            json.dump(data_list, f, indent=2)
        logger.info(f"Database saved successfully. Total seen jobs count: {len(data_list)}")
    except Exception as e:
        logger.error(f"Error saving seen_jobs.json: {e}", exc_info=True)

def prune_seen_jobs(seen_jobs: Dict[str, Dict[str, Any]], max_days: int) -> Dict[str, Dict[str, Any]]:
    """Removes database entries older than max_days to prevent infinite file growth."""
    pruned: Dict[str, Dict[str, Any]] = {}
    cutoff_date = datetime.utcnow() - timedelta(days=max_days)
    
    removed_count = 0
    for job_id, job_data in seen_jobs.items():
        date_str = job_data.get("date_found", "")
        try:
            date_found = datetime.strptime(date_str, "%Y-%m-%d")
            if date_found >= cutoff_date:
                pruned[job_id] = job_data
            else:
                removed_count += 1
        except Exception:
            # Keep if date format is invalid
            pruned[job_id] = job_data

    if removed_count > 0:
        logger.info(f"Pruned {removed_count} records older than {max_days} days from seen database.")
    return pruned

def is_location_acceptable(location_str: str) -> bool:
    """Returns True if the location is Bangalore, Bengaluru, Remote, or general India fallback."""
    loc_lower = location_str.lower()
    
    # If location explicitly specifies remote or global work from home, it is acceptable
    if any(term in loc_lower for term in ["remote", "wfh", "work from home", "anywhere", "worldwide", "global", "home"]):
        return True
        
    # If it is Bangalore/Bengaluru, it is acceptable
    if "bangalore" in loc_lower or "bengaluru" in loc_lower:
        return True
        
    # If it specifies other Indian cities and does not mention remote, reject
    other_cities = ["hyderabad", "pune", "mumbai", "chennai", "noida", "gurgaon", "gurugram", "delhi", "kolkata"]
    if any(city in loc_lower for city in other_cities):
        return False
        
    # If it is just general "india" or general remote fallback
    if "india" in loc_lower or loc_lower == "remote" or loc_lower == "":
        return True
        
    # Ignore international onsite roles that require relocation
    return False

# =====================================================================
# Job Scoring & Filtering Engine
# =====================================================================

def compute_job_score(job: Job) -> Tuple[int, str]:
    """
    Computes a matching score (0 to 100) based on title keywords.
    Returns the score and the corresponding Tier label.
    """
    # 0. Location Filter (Strict Reject)
    if not is_location_acceptable(job.location):
        logger.debug(f"Rejecting job '{job.title}' due to location: '{job.location}'")
        return 0, "Rejected"

    title_lower = job.title.lower()
    description_lower = job.description.lower() if job.description else ""
    experience_lower = job.experience.lower() if job.experience else ""

    # 1. Negative Filters Exclusions (Strict Reject)
    for negative in NEGATIVE_FILTERS:
        # Match using word boundaries to avoid false positives (e.g. "SDE" matching "SDESomething")
        pattern = r"\b" + re.escape(negative.lower()) + r"\b"
        if re.search(pattern, title_lower):
            logger.debug(f"Rejecting job '{job.title}' due to negative keyword: '{negative}'")
            return 0, "Rejected"

    # 2. Experience Exclusions
    # Reject jobs that explicitly state senior/lead requirements unless they also explicitly contain entry-level tags
    has_positive_exp = any(
        (pos in title_lower or pos in experience_lower)
        for pos in POSITIVE_EXPERIENCE_KEYWORDS
    )
    
    if not has_positive_exp:
        # Check for senior/lead/manager keywords
        for negative_exp in NEGATIVE_EXPERIENCE_KEYWORDS:
            pattern = r"\b" + re.escape(negative_exp.lower()) + r"\b"
            if re.search(pattern, title_lower) or re.search(pattern, experience_lower):
                logger.debug(f"Rejecting job '{job.title}' due to senior experience filter: '{negative_exp}'")
                return 0, "Rejected"
            
        # Parse description for X+ years of experience patterns (e.g., "5+ years", "3-5 years")
        # If we see "3+ years", "4+ years", "5+ years", "6+ years", "7+ years", "8+ years" etc.
        # We reject. We allow "0-2 years", "1-2 years", "0-1 years".
        years_match = re.findall(r"(\d+)\s*\+?\s*(?:to|-)?\s*\d*\s*years?", description_lower)
        for val in years_match:
            try:
                years = int(val)
                if years >= 3:
                    logger.debug(f"Rejecting job '{job.title}' due to description experience requirement: {years}+ years")
                    return 0, "Rejected"
            except ValueError:
                continue

    # 3. Match Keywords & Determine Score
    max_score = 0
    matched_any = False

    for keyword, weight in KEYWORD_WEIGHTS.items():
        # Use simple substring checks or regex word boundaries
        if keyword in title_lower:
            matched_any = True
            if weight > max_score:
                max_score = weight

    # If title matched nothing, check description (with lower weights/penalty)
    if not matched_any and description_lower:
        for keyword, weight in KEYWORD_WEIGHTS.items():
            if keyword in description_lower:
                # Penalty for description-only match
                adjusted_weight = max(50, weight - 20)
                if adjusted_weight > max_score:
                    max_score = adjusted_weight

    # Classification into Tiers
    if max_score >= TIER_A_MIN:
        return max_score, "Tier A"
    elif max_score >= TIER_B_MIN:
        return max_score, "Tier B"
    elif max_score >= TIER_C_MIN:
        return max_score, "Tier C"
    else:
        return max_score, "Below Threshold"

# =====================================================================
# Main Orchestrator
# =====================================================================

def run_job_discovery() -> Tuple[List[Job], int]:
    """
    Executes all collectors, processes new jobs, scores/filters them,
    updates seen database, and returns the list of new jobs found.
    """
    logger.info("Initializing Career Radar Job Discovery Engine...")
    seen_jobs = load_seen_jobs()
    
    # Prune seen jobs
    seen_jobs = prune_seen_jobs(seen_jobs, MAX_DAYS_TO_KEEP)
    
    # Initialize all active collectors
    collectors = [
        GreenhouseCollector(),
        LeverCollector(),
        AshbyCollector(),
        WorkdayCollector(),
        TeslaCollector(),
        LinkedInCollector(),
        NaukriCollector(),
        InternshalaCollector()
    ]
    
    all_discovered_jobs: List[Job] = []
    scanned_count = 0
    
    # Run collectors sequentially
    for collector in collectors:
        try:
            logger.info(f"Running collector: {collector.name}...")
            jobs = collector.collect()
            scanned_count += len(jobs)
            all_discovered_jobs.extend(jobs)
            logger.info(f"Collector {collector.name} complete. Discovered {len(jobs)} jobs.")
        except Exception as e:
            logger.error(f"Collector {collector.name} failed during execution: {e}", exc_info=True)
            
    logger.info(f"All collectors complete. Total raw jobs scanned: {scanned_count}")
    
    # Remove duplicates within the current collection run (by apply_link or job_id)
    unique_run_jobs: List[Job] = []
    seen_links_in_run = set()
    seen_ids_in_run = set()
    
    for job in all_discovered_jobs:
        if job.apply_link in seen_links_in_run or job.job_id in seen_ids_in_run:
            continue
        unique_run_jobs.append(job)
        seen_links_in_run.add(job.apply_link)
        seen_ids_in_run.add(job.job_id)
        
    logger.info(f"Total unique jobs in current run: {len(unique_run_jobs)}")
    
    # Filter against database of already seen/sent jobs
    new_jobs: List[Job] = []
    for job in unique_run_jobs:
        # Duplicate checks (using job_id OR apply_link)
        is_duplicate = False
        if job.job_id in seen_jobs:
            is_duplicate = True
        else:
            # Check by apply_link
            for seen_id, seen_job in seen_jobs.items():
                if seen_job.get("apply_link") == job.apply_link:
                    is_duplicate = True
                    break
                    
        if is_duplicate:
            continue

        # Score and check thresholds
        score, tier = compute_job_score(job)
        if score < TIER_C_MIN:
            # Exclude jobs scoring below threshold
            continue
            
        # Enrich job with scoring metrics
        job.score = score
        job.tier = tier
        new_jobs.append(job)
        
        # Add to local seen database state immediately
        seen_jobs[job.job_id] = job.to_dict()

    logger.info(f"Filtering complete. Found {len(new_jobs)} NEW relevant opportunities.")
    
    # Save updated seen jobs database
    save_seen_jobs(seen_jobs)
    
    return new_jobs, scanned_count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_job_discovery()
