import asyncio
import json
import logging
import subprocess

from browser_use import Agent, ChatOpenAI
from browser_use.browser.session import BrowserSession
from playwright.async_api import Page, async_playwright
from pydantic import BaseModel

from src.extractor import run_extract
from src.models import Workflow, WorkflowStep
from src.utils import CDP_URL, wait_for_cdp, resolve_params, get_locator, chrome_launch_args

logger = logging.getLogger(__name__)

browser_llm = ChatOpenAI(model="gpt-5.2", temperature=0.2)


class HealedSelector(BaseModel):
    command: str


def _patch_step_command(workflow_path: str, idx: int, command: str) -> None:
    with open(workflow_path) as f:
        data = json.load(f)
    if idx < len(data.get("steps", [])):
        data["steps"][idx]["command"] = command
        with open(workflow_path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info("Patched workflow step %d with healed selector: %s", idx, command)


async def run_ai_with_retry(step: WorkflowStep, bu_session: BrowserSession) -> str | None:
    task = (step.task or step.instruction) + (
        "\n\nAfter completing the action, output the exact Playwright locator expression you used "
        "(without 'page.' prefix, e.g. get_by_role(\"button\", name=\"Submit\") or locator(\"#id\"))."
    )
    for attempt in range(1, 4):
        try:
            agent = Agent(task=task, llm=browser_llm, browser_session=bu_session, output_model=HealedSelector)
            history = await agent.run()
            if history.is_done():
                result: HealedSelector = history.final_result()
                if result and result.command:
                    logger.info("AI healed selector: %s", result.command)
                    return result.command
                return None
            logger.warning("AI attempt %d: agent did not complete", attempt)
        except Exception as exc:
            logger.warning("AI attempt %d failed: %s", attempt, exc)
        if attempt == 3:
            raise RuntimeError(f"AI step did not complete after 3 attempts: {step.task or step.instruction}")
        await asyncio.sleep(2)
    return None


async def run_playwright_with_fallback(
    step: WorkflowStep,
    idx: int,
    page: Page,
    bu_session: BrowserSession,
    params: dict,
    retries: dict,
) -> str | None:
    if step.skip_command:
        logger.debug("skip_command=true — going straight to AI")
        await run_ai_with_retry(step, bu_session)
        return None

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

            elif step.type == "scroll":
                await page.evaluate(f"window.scrollTo({step.scroll_x or 0}, {step.scroll_y or 0})")

            else:
                raise ValueError(f"Unknown step type: {step.type}")

            retries[idx] = 0
            return None

        except Exception as exc:
            retries[idx] = retries.get(idx, 0) + 1
            count = retries[idx]
            if count >= step.max_retries:
                logger.warning("Failed %dx — handing off to AI for healing: %s", count, exc)
                return await run_ai_with_retry(step, bu_session)
            logger.warning("Attempt %d failed: %s  (retrying in 1s)", count, exc)
            await asyncio.sleep(1)


async def run_workflow(
    workflow: Workflow,
    headless: bool = False,
    params: dict | None = None,
    workflow_path: str | None = None,
) -> None:
    if params is None:
        params = {}
    missing = [p for p in workflow.parameters if p not in params]
    if missing:
        raise ValueError(f"Missing required parameters: {missing}")

    proc = subprocess.Popen(chrome_launch_args(headless=headless), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[-1] if context.pages else await context.new_page()

            bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
            await bu_session.start()

            retries: dict[int, int] = {}
            for i, step in enumerate(workflow.steps):
                logger.info("[%d/%d] %-8s  %s", i + 1, len(workflow.steps), step.type, step.instruction)

                if step.type == "wait":
                    await asyncio.sleep(step.duration)

                elif step.type == "ai":
                    await run_ai_with_retry(step, bu_session)

                elif step.type == "extract":
                    await run_extract(step, page)

                else:
                    healed = await run_playwright_with_fallback(step, i, page, bu_session, params, retries)
                    if healed and workflow_path:
                        _patch_step_command(workflow_path, i, healed)
                        step.command = healed

            logger.info("Workflow complete.")
            await bu_session.stop()
    finally:
        proc.terminate()
        proc.wait()
