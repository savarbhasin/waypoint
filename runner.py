"""
Executes a workflow JSON using Playwright for deterministic steps
and browser-use Agent for AI steps (or as fallback after repeated failures).

Browser sharing: Chrome is launched with --remote-debugging-port so both
Playwright (connect_over_cdp) and browser-use (BrowserSession cdp_url) share
the same running instance — same page, same cookies, same state.
"""
import asyncio
import subprocess
import tempfile
import urllib.request
import anthropic
from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page
from browser_use.browser.session import BrowserSession
from workflow import Workflow, WorkflowStep
from extractor import run_extract

load_dotenv()

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"


def _resolve(value: str, params: dict) -> str:
    """Substitute {param} placeholders with runtime values."""
    for k, v in params.items():
        value = value.replace(f"{{{k}}}", str(v))
    return value


def _get_locator(page: Page, command: str):
    """Evaluate a locator command string against a page. Safe — only page.* calls."""
    return eval(f"page.{command}", {"__builtins__": {}}, {"page": page})


async def execute_step(step: WorkflowStep, page: Page, params: dict = {}) -> None:
    if step.type == "navigate":
        url = _resolve(step.url or "", params)
        await page.goto(url, wait_until="domcontentloaded")

    elif step.type == "click":
        loc = _get_locator(page, step.command).first
        await loc.wait_for(state="visible", timeout=10_000)
        await loc.click()

    elif step.type == "fill":
        loc = _get_locator(page, step.command).first
        await loc.wait_for(state="visible", timeout=10_000)
        await loc.fill(_resolve(step.value or "", params))

    elif step.type == "select":
        loc = _get_locator(page, step.command).first
        await loc.wait_for(state="visible", timeout=10_000)
        await loc.select_option(_resolve(step.value or "", params))

    else:
        raise ValueError(f"Unknown step type: {step.type}")


async def run_ai_step(task: str, session: BrowserSession, llm) -> None:
    from browser_use import Agent
    agent = Agent(task=task, llm=llm, browser_session=session)
    await agent.run()


async def run_workflow(workflow: Workflow, headless: bool = False, params: dict = {}) -> None:
    # Merge workflow default parameters with any passed at runtime
    run_params = {**workflow.parameters, **params}
    llm = _build_llm()
    anthropic_client = anthropic.AsyncAnthropic()

    # Launch Chrome with remote debugging so both Playwright and browser-use share it
    user_data_dir = tempfile.mkdtemp(prefix="bap_profile_")
    chrome_args = [
        _find_chrome(),
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={user_data_dir}",
        "--no-first-run",
        "--no-default-browser-check",
    ]
    if headless:
        chrome_args.append("--headless=new")

    proc = subprocess.Popen(chrome_args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await _wait_for_cdp()

    try:
        async with async_playwright() as p:
            # Playwright connects over CDP
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()

            # browser-use session connects to the same CDP endpoint
            bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
            await bu_session.start()

            for i, step in enumerate(workflow.steps):
                print(f"\n[{i+1}/{len(workflow.steps)}] {step.type:8s}  {step.instruction}")

                if step.type == "ai":
                    await _run_ai_with_retry(step, bu_session, llm)

                elif step.type == "extract":
                    # Refresh playwright page ref in case browser-use navigated
                    page = await _current_page(context, bu_session)
                    await run_extract(
                        page,
                        method=step.method or "screenshot",
                        instruction=step.extract_instruction or step.instruction,
                        client=anthropic_client,
                    )

                else:
                    await _run_playwright_with_fallback(step, page, bu_session, llm, run_params)
                    page = await _current_page(context, bu_session)

            print("\nWorkflow complete.")
            await bu_session.stop()
    finally:
        proc.terminate()


async def _current_page(context, bu_session: BrowserSession) -> Page:
    """Return the active Playwright page from the shared CDP context."""
    # Always use Playwright's own context — bu_session.get_current_page() returns
    # browser-use's internal Page model which lacks Playwright's locator API.
    return context.pages[-1] if context.pages else await context.new_page()


async def _run_playwright_with_fallback(
    step: WorkflowStep, page: Page, bu_session: BrowserSession, llm, params: dict = {}
) -> None:
    while True:
        try:
            await execute_step(step, page, params)
            step.retry_count = 0
            return
        except Exception as exc:
            step.retry_count += 1
            if step.retry_count >= step.max_retries:
                print(f"  ! Failed {step.retry_count}x — handing off to AI: {exc}")
                await _run_ai_with_retry(step, bu_session, llm)
                return
            print(f"  ! Attempt {step.retry_count} failed: {exc}  (retrying in 1s)")
            await asyncio.sleep(2)


async def _run_ai_with_retry(step: WorkflowStep, bu_session: BrowserSession, llm) -> None:
    task = step.task or step.instruction
    for attempt in range(1, 4):
        try:
            await run_ai_step(task, bu_session, llm)
            return
        except Exception as exc:
            print(f"  ! AI attempt {attempt} failed: {exc}")
            if attempt == 3:
                raise RuntimeError(f"AI step failed after 3 attempts: {task}") from exc
            await asyncio.sleep(2)


def _build_llm():
    from browser_use import ChatAnthropic
    return ChatAnthropic(model="claude-sonnet-4-6", temperature=0.0)


async def _wait_for_cdp(timeout: float = 10.0) -> None:
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        try:
            urllib.request.urlopen(f"{CDP_URL}/json/version", timeout=1)
            return
        except Exception:
            if asyncio.get_event_loop().time() > deadline:
                raise RuntimeError("Chrome did not start in time — is another process using port 9222?")
            await asyncio.sleep(0.3)


def _find_chrome() -> str:
    import shutil, sys
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "google-chrome",
        "chromium",
        "chromium-browser",
    ]
    for c in candidates:
        if c.startswith("/"):
            import os
            if os.path.exists(c):
                return c
        else:
            found = shutil.which(c)
            if found:
                return found
    raise RuntimeError("Could not find Chrome/Chromium. Install Google Chrome or set CHROME_PATH.")
