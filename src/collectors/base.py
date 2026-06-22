import time
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import requests
from src.models import Job

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

class BaseCollector(ABC):
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"Collector.{self.name}")
        self.session = requests.Session()
        # Common desktop user agent
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "application/json, text/html, */*"
        })

    @abstractmethod
    def collect(self) -> List[Job]:
        """Fetch jobs from the source, normalize, and return them."""
        pass

    def _make_request(
        self,
        url: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        retries: int = 3,
        backoff_factor: float = 1.5,
        timeout: int = 15
    ) -> Optional[requests.Response]:
        """Performs an HTTP request with retry logic and exponential backoff."""
        req_headers = self.session.headers.copy()
        if headers:
            req_headers.update(headers)

        for attempt in range(retries):
            try:
                if method.upper() == "POST":
                    response = self.session.post(
                        url, data=data, json=json_data, headers=req_headers, params=params, timeout=timeout
                    )
                else:
                    response = self.session.get(
                        url, headers=req_headers, params=params, timeout=timeout
                    )

                # Check for rate limiting (429) or server errors (5xx)
                if response.status_code == 429:
                    self.logger.warning(
                        f"Rate limited (429) on attempt {attempt + 1}. Retrying..."
                    )
                elif 500 <= response.status_code < 600:
                    self.logger.warning(
                        f"Server error ({response.status_code}) on attempt {attempt + 1}. Retrying..."
                    )
                else:
                    response.raise_for_status()
                    return response

            except (requests.RequestException, Exception) as e:
                self.logger.warning(
                    f"Request failed on attempt {attempt + 1} for URL {url}: {e}"
                )

            # Sleep with backoff before next attempt
            if attempt < retries - 1:
                sleep_time = backoff_factor ** attempt
                self.logger.info(f"Sleeping for {sleep_time:.2f} seconds before retrying...")
                time.sleep(sleep_time)

        self.logger.error(f"Failed to fetch {url} after {retries} attempts.")
        return None
