import asyncio
import base64
import os
import shutil
import socket
import urllib.request

from playwright.async_api import Page

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"

CHROME_PROFILE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".chrome-data")

# Headless Chrome defaults to an 800x600 window if not told otherwise — match the
# live view's screencast maxWidth/maxHeight so the feed isn't just upscaled/blurry.
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 800


def find_free_port() -> int:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]
    finally:
        sock.close()


def chrome_launch_args(headless: bool = False, port: int | None = None, profile_dir: str | None = None) -> list[str]:
    """Build Chrome subprocess args with an isolated profile so macOS doesn't hijack the running instance."""
    port = port if port is not None else CDP_PORT
    profile_dir = profile_dir if profile_dir is not None else CHROME_PROFILE_DIR
    os.makedirs(profile_dir, exist_ok=True)
    args = [
        find_chrome(),
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={profile_dir}",
        f"--window-size={WINDOW_WIDTH},{WINDOW_HEIGHT}",
    ]
    if headless:
        args.append("--headless=new")
    return args


def find_chrome() -> str:
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
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


async def wait_for_cdp(timeout: float = 10.0, port: int | None = None) -> None:
    port = port if port is not None else CDP_PORT
    url = f"http://127.0.0.1:{port}"
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        try:
            urllib.request.urlopen(f"{url}/json/version", timeout=1)
            return
        except Exception:
            if asyncio.get_event_loop().time() > deadline:
                raise RuntimeError(f"Chrome did not start in time — is port {port} already in use?")
            await asyncio.sleep(0.3)


async def screenshot_b64(page: Page) -> str:
    png = await page.screenshot(full_page=True)
    return base64.standard_b64encode(png).decode()
