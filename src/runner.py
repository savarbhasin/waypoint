import asyncio
import logging
import subprocess
import tempfile

from browser_use import Agent, ChatOpenAI
from browser_use.browser.session import BrowserSession
from playwright.async_api import Page, async_playwright

from src.extractor import run_extract
from src.models import Workflow, WorkflowStep
from src.utils import CDP_URL, find_chrome, wait_for_cdp, resolve_params, get_locator

logger = logging.getLogger(__name__)

browser_llm = ChatOpenAI(model="gpt-5.2", temperature=0.2)



async def run_ai_with_retry(step: WorkflowStep, bu_session: BrowserSession) -> None:
    task = step.task or step.instruction
    for attempt in range(1, 4):
        try:
            agent = Agent(task=task, llm=browser_llm, browser_session=bu_session)
            history = await agent.run()
            done = history.is_done()
            if done and history.final_result():
                logger.info("AI done: %s", history.final_result())
            if done:
                return
            logger.warning("AI attempt %d: agent did not complete the task (max steps reached)", attempt)
        except Exception as exc:
            logger.warning("AI attempt %d failed: %s", attempt, exc)
        if attempt == 3:
            raise RuntimeError(f"AI step did not complete after 3 attempts: {task}")
        await asyncio.sleep(2)


async def run_playwright_with_fallback(
    step: WorkflowStep,
    page: Page,
    bu_session: BrowserSession,
    params: dict,
    retries: dict,
) -> None:
    if step.skip_command:
        logger.debug("skip_command=true — going straight to AI")
        await run_ai_with_retry(step, bu_session)
        return

    while True:
        try:
            if step.type == "navigate":
                await page.goto(resolve_params(step.url or "", params), wait_until="domcontentloaded")

            elif step.type == "click":
                loc = get_locator(page, step.command).first
                await loc.wait_for(state="visible", timeout=10_000)
                await loc.click()

            elif step.type == "fill":
                loc = get_locator(page, step.command).first
                await loc.wait_for(state="visible", timeout=10_000)
                await loc.fill(resolve_params(step.value or "", params))

            elif step.type == "select":
                loc = get_locator(page, step.command).first
                await loc.wait_for(state="visible", timeout=10_000)
                await loc.select_option(resolve_params(step.value or "", params))

            else:
                raise ValueError(f"Unknown step type: {step.type}")
            
            retries[step.id] = 0
            return
        except Exception as exc:
            retries[step.id] = retries.get(step.id, 0) + 1
            count = retries[step.id]
            if count >= step.max_retries:
                logger.warning("Failed %dx — handing off to AI: %s", count, exc)
                await run_ai_with_retry(step, bu_session)
                return
            logger.warning("Attempt %d failed: %s  (retrying in 1s)", count, exc)
            await asyncio.sleep(1)


async def run_workflow(workflow: Workflow, headless: bool = False, params: dict = {}) -> None:
    missing = [p for p in workflow.parameters if p not in params]
    if missing:
        raise ValueError(f"Missing required parameters: {missing}")

    chrome_args = [
        find_chrome(),
        "--remote-debugging-port=9222",
        "--no-first-run",
        "--no-default-browser-check",
    ]
    
    if headless:
        chrome_args.append("--headless=new")

    proc = subprocess.Popen(chrome_args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()

            bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
            await bu_session.start()

            retries: dict[str, int] = {}
            page = context.pages[-1] if context.pages else page
            for i, step in enumerate(workflow.steps):
                logger.info("[%d/%d] %-8s  %s", i + 1, len(workflow.steps), step.type, step.instruction)

                if step.type == "wait":
                    await asyncio.sleep(step.duration)

                elif step.type == "ai":
                    await run_ai_with_retry(step, bu_session)

                elif step.type == "extract":
                    await run_extract(step, page)

                else:
                    await run_playwright_with_fallback(step, page, bu_session, params, retries)

            logger.info("Workflow complete.")
            await bu_session.stop()
    finally:
        proc.terminate()
