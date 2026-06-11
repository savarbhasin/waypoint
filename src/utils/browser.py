import asyncio
import base64
import os
import shutil
import urllib.request

from playwright.async_api import Page

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"


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
