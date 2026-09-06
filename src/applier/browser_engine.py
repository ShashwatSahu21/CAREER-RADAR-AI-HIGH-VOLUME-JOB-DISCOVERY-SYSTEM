"""
AutoApply Engine — Anti-Detection Browser Automation Engine
Powered by Playwright with advanced human-simulation heuristics:
- Stealth plugins and navigator property overrides
- Gaussian/Bézier curve mouse trajectories with jitter
- Natural human typing speed (40-120ms jitter) with typo simulation
- Dynamic viewport, randomized headers & WebGL vendor spoofing
- Session & Cookie persistence across runs
- Automated CAPTCHA / bot challenge detection
- DOM field discovery & smart interaction helpers
"""

import asyncio
import json
import logging
import math
import os
import random
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("AutoApply.BrowserEngine")

# Session storage directory
SESSIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "sessions"
)

# Common realistic user-agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]

VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1536, "height": 864},
    {"width": 1440, "height": 900},
    {"width": 1366, "height": 768},
]


class BrowserEngine:
    """
    High-level stealth browser manager wrapping Playwright.
    Provides human-like interaction methods to evade bot detection.
    """

    def __init__(
        self,
        headless: bool = True,
        session_name: Optional[str] = None,
        slow_mo_ms: int = 50,
    ):
        self.headless = headless
        self.session_name = session_name
        self.slow_mo_ms = slow_mo_ms
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self._current_mouse_pos = (random.randint(100, 400), random.randint(100, 300))

        os.makedirs(SESSIONS_DIR, exist_ok=True)

    async def start(self) -> "BrowserEngine":
        """Initialize and launch the stealth Playwright browser instance."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise ImportError(
                "Playwright is not installed. Please install it via `pip install playwright` "
                "and run `playwright install chromium`."
            )

        self.playwright = await async_playwright().start()

        # Stealth launch arguments
        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-site-isolation-trials",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--window-position=0,0",
            "--ignore-certificate-errors",
        ]

        self.browser = await self.playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo_ms,
            args=launch_args,
        )

        viewport = random.choice(VIEWPORTS)
        user_agent = random.choice(USER_AGENTS)

        session_path = self._get_session_path() if self.session_name else None
        storage_state = session_path if session_path and os.path.exists(session_path) else None

        self.context = await self.browser.new_context(
            viewport=viewport,
            user_agent=user_agent,
            locale="en-US",
            timezone_id="Asia/Kolkata",
            geolocation={"latitude": 28.6139, "longitude": 77.2090},
            permissions=["geolocation"],
            storage_state=storage_state,
            device_scale_factor=1,
            has_touch=False,
            is_mobile=False,
        )

        # Inject stealth scripts to mask webdriver and automation fingerprints
        await self.context.add_init_script("""
            // Mask navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Mock chrome runtime object
            window.chrome = {
                app: { isInstalled: false },
                webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
                runtime: { PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' } },
            };

            // Mock languages and plugins
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Mock WebGL vendor & renderer
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel(R) Iris(R) Xe Graphics Direct3D11 VS_5_0 PS_5_0';
                }
                return getParameter.apply(this, arguments);
            };
        """)

        self.page = await self.context.new_page()
        logger.info(f"Browser engine started (headless={self.headless}, session={self.session_name})")
        return self

    async def close(self):
        """Save session state and gracefully close the browser."""
        if self.context and self.session_name:
            try:
                session_path = self._get_session_path()
                await self.context.storage_state(path=session_path)
                logger.info(f"Saved session state to {session_path}")
            except Exception as e:
                logger.warning(f"Failed to save session state: {e}")

        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Browser engine terminated.")

    def _get_session_path(self) -> str:
        safe_name = "".join(c for c in (self.session_name or "default") if c.isalnum() or c in ("-", "_"))
        return os.path.join(SESSIONS_DIR, f"{safe_name}_state.json")

    # ═══════════════════════════════════════
    # HUMAN-LIKE INTERACTION METHODS
    # ═══════════════════════════════════════

    async def navigate(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 45000):
        """Navigate to URL with realistic delays and challenge checking."""
        logger.info(f"Navigating to {url}")
        await self.page.goto(url, wait_until=wait_until, timeout=timeout)
        await self.human_delay(1.5, 3.5)
        await self.check_bot_challenge()

    async def human_delay(self, min_sec: float = 0.5, max_sec: float = 2.0):
        """Sleep for a randomized float interval."""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)

    async def type_human(self, selector: str, text: str, clear_first: bool = True):
        """
        Type text into an input field character by character with realistic typing cadence,
        occasional brief hesitations, and typing speed variations.
        """
        element = await self.page.wait_for_selector(selector, state="visible", timeout=10000)
        if not element:
            raise ValueError(f"Selector not found for typing: {selector}")

        # Hover and click to focus
        await self.move_mouse_smoothly_to_element(selector)
        await element.click()
        await self.human_delay(0.2, 0.5)

        if clear_first:
            await self.page.keyboard.press("Control+A" if os.name == "nt" else "Meta+A")
            await self.page.keyboard.press("Backspace")
            await self.human_delay(0.1, 0.3)

        for i, char in enumerate(text):
            # Dynamic typing delay (40ms - 130ms)
            delay = random.uniform(0.04, 0.13)
            # Add longer pause at word boundaries or punctuation
            if char in (" ", ",", ".", "@", "-", "_"):
                delay += random.uniform(0.08, 0.22)
            # Random slight pause simulating cognitive thought
            if random.random() < 0.04 and i > 0:
                await asyncio.sleep(random.uniform(0.3, 0.7))

            await self.page.keyboard.type(char)
            await asyncio.sleep(delay)

        await self.human_delay(0.3, 0.8)

    async def click_human(self, selector: str, wait_after: float = 1.0):
        """Move mouse smoothly to an element using a curved path and click naturally."""
        element = await self.page.wait_for_selector(selector, state="visible", timeout=10000)
        if not element:
            raise ValueError(f"Selector not found for click: {selector}")

        await self.move_mouse_smoothly_to_element(selector)
        await self.human_delay(0.1, 0.3)
        await element.click()
        await self.human_delay(wait_after * 0.8, wait_after * 1.3)

    async def move_mouse_smoothly_to_element(self, selector: str, steps: int = 20):
        """Simulate Bézier curve mouse trajectory towards the center of an element."""
        try:
            box = await self.page.locator(selector).bounding_box()
            if not box:
                return

            target_x = box["x"] + box["width"] * random.uniform(0.3, 0.7)
            target_y = box["y"] + box["height"] * random.uniform(0.3, 0.7)

            start_x, start_y = self._current_mouse_pos

            # Create random control points for Bézier curve
            ctrl1_x = start_x + (target_x - start_x) * 0.25 + random.randint(-40, 40)
            ctrl1_y = start_y + (target_y - start_y) * 0.25 + random.randint(-40, 40)
            ctrl2_x = start_x + (target_x - start_x) * 0.75 + random.randint(-20, 20)
            ctrl2_y = start_y + (target_y - start_y) * 0.75 + random.randint(-20, 20)

            for i in range(1, steps + 1):
                t = i / steps
                # Cubic Bézier formula
                x = (1-t)**3 * start_x + 3*(1-t)**2*t * ctrl1_x + 3*(1-t)*t**2 * ctrl2_x + t**3 * target_x
                y = (1-t)**3 * start_y + 3*(1-t)**2*t * ctrl1_y + 3*(1-t)*t**2 * ctrl2_y * 1.0

                await self.page.mouse.move(x, y)
                await asyncio.sleep(random.uniform(0.005, 0.015))

            self._current_mouse_pos = (target_x, target_y)
        except Exception as e:
            logger.debug(f"Smooth mouse move ignored: {e}")

    async def upload_file(self, selector: str, file_path: str):
        """Upload a file to an input[type=file] element."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File to upload does not exist: {file_path}")

        logger.info(f"Uploading file {os.path.basename(file_path)} to selector: {selector}")
        file_input = await self.page.wait_for_selector(selector, state="attached", timeout=10000)
        if file_input:
            await file_input.set_input_files(file_path)
            await self.human_delay(1.0, 2.5)

    async def select_dropdown(self, selector: str, value_or_label: str):
        """Select an option from a standard <select> dropdown by value or text."""
        element = await self.page.wait_for_selector(selector, state="visible", timeout=8000)
        if element:
            await self.move_mouse_smoothly_to_element(selector)
            try:
                # Try selecting by label first
                await self.page.select_option(selector, label=value_or_label)
            except Exception:
                # Fallback to value or index
                await self.page.select_option(selector, value=value_or_label)
            await self.human_delay(0.4, 0.9)

    async def scroll_page(self, distance: int = 400, direction: str = "down"):
        """Scroll naturally down or up with small increments."""
        sign = 1 if direction == "down" else -1
        increments = random.randint(4, 8)
        step = (distance / increments) * sign

        for _ in range(increments):
            await self.page.mouse.wheel(0, step)
            await asyncio.sleep(random.uniform(0.08, 0.18))

        await self.human_delay(0.5, 1.2)

    async def capture_screenshot(self, name: str) -> str:
        """Capture screenshot of the active page and save to storage."""
        screenshot_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "careerpilot", "storage", "screenshots"
        )
        os.makedirs(screenshot_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        filepath = os.path.join(screenshot_dir, filename)

        try:
            await self.page.screenshot(path=filepath, full_page=True)
            logger.info(f"Captured screenshot: {filepath}")
            return filepath
        except Exception as e:
            logger.warning(f"Screenshot failed: {e}")
            return ""

    # ═══════════════════════════════════════
    # CHALLENGE & FORM ANALYSIS
    # ═══════════════════════════════════════

    async def check_bot_challenge(self) -> bool:
        """
        Inspect page for Cloudflare Turnstile, reCAPTCHA, or LinkedIn verification challenges.
        Returns True if a challenge was detected.
        """
        challenge_indicators = [
            "text=Verify you are human",
            "text=Please verify your identity",
            "text=Security Verification",
            "iframe[src*='recaptcha']",
            "iframe[src*='turnstile']",
            "iframe[src*='challenge']",
            "#captcha-internal",
            ".captcha-challenge",
        ]

        for ind in challenge_indicators:
            try:
                count = await self.page.locator(ind).count()
                if count > 0:
                    logger.warning(f"⚠️ Anti-bot challenge detected via selector: {ind}")
                    return True
            except Exception:
                pass
        return False

    async def detect_form_fields(self) -> List[Dict[str, Any]]:
        """
        Extract visible input, textarea, and select fields with their labels,
        types, required flags, and possible option values.
        """
        script = """
        () => {
            const fields = [];
            const elements = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
            
            elements.forEach((el, index) => {
                const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                if (!isVisible) return;
                
                const id = el.id || '';
                const name = el.name || '';
                const type = el.type || el.tagName.toLowerCase();
                const placeholder = el.placeholder || '';
                const required = el.required || el.getAttribute('aria-required') === 'true';
                
                // Find associated label
                let labelText = '';
                if (id) {
                    const labelEl = document.querySelector(`label[for="${id}"]`);
                    if (labelEl) labelText = labelEl.innerText.trim();
                }
                if (!labelText) {
                    const parentLabel = el.closest('label');
                    if (parentLabel) labelText = parentLabel.innerText.trim();
                }
                if (!labelText && el.getAttribute('aria-label')) {
                    labelText = el.getAttribute('aria-label');
                }
                
                // Extract options if select
                let options = [];
                if (el.tagName.toLowerCase() === 'select') {
                    options = Array.from(el.options).map(o => ({
                        text: o.text.trim(),
                        value: o.value
                    }));
                }

                fields.push({
                    index,
                    id,
                    name,
                    type,
                    labelText,
                    placeholder,
                    required,
                    options,
                    selector: id ? `#${id}` : (name ? `[name="${name}"]` : null)
                });
            });
            
            return fields;
        }
        """
        try:
            return await self.page.evaluate(script)
        except Exception as e:
            logger.error(f"Error detecting form fields: {e}")
            return []
