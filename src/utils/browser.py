import asyncio
import base64
import os
import shutil
import urllib.request

from playwright.async_api import Page

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"

CHROME_PROFILE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".chrome-data")


def chrome_launch_args(headless: bool = False) -> list[str]:
    """Build Chrome subprocess args with an isolated profile so macOS doesn't hijack the running instance."""
    os.makedirs(CHROME_PROFILE_DIR, exist_ok=True)
    args = [
        find_chrome(),
        f"--remote-debugging-port={CDP_PORT}",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={CHROME_PROFILE_DIR}",
    ]
    if headless:
        args.append("--headless=new")
    return args


def find_chrome() -> str:
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "google-chrome",
        "chromium",
        "chromium-browser",
    ]
    for c in candidates:
        if c.startswith("/"):
            if os.path.exists(c):
                return c
        else:
            found = shutil.which(c)
            if found:
                return found
    raise RuntimeError("Could not find Chrome/Chromium. Install Google Chrome.")


async def wait_for_cdp(timeout: float = 10.0) -> None:
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        try:
            urllib.request.urlopen(f"{CDP_URL}/json/version", timeout=1)
            return
        except Exception:
            if asyncio.get_event_loop().time() > deadline:
                raise RuntimeError("Chrome did not start in time — is port 9222 already in use?")
            await asyncio.sleep(0.3)


async def screenshot_b64(page: Page) -> str:
    png = await page.screenshot(full_page=True)
    return base64.standard_b64encode(png).decode()
