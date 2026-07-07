import asyncio
import json
import logging
import subprocess
import uuid
from typing import Any

from browser_use import Agent, ChatOpenAI
from browser_use.browser.session import BrowserSession
from playwright.async_api import async_playwright
from pydantic import BaseModel

from src.events import EventEmitter, RunEvent
from src.extractor import run_extract
from src.models import Workflow, WorkflowStep
from src.tabs import PageTracker
from src.utils import CDP_PORT, wait_for_cdp, resolve_params, get_locator, chrome_launch_args

logger = logging.getLogger(__name__)

browser_llm = ChatOpenAI(model="gpt-5.2", temperature=0.2)


class HealedSelector(BaseModel):
    command: str


async def noop_on_event(event: RunEvent) -> None:
    pass


async def _emit(on_event: EventEmitter, run_id: str, **kwargs: Any) -> None:
    await on_event(RunEvent(run_id=run_id, **kwargs))


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
            agent = Agent(task=task, llm=browser_llm, browser_session=bu_session, output_model_schema=HealedSelector)
            history = await agent.run()
            if history.is_done():
                result: HealedSelector | None = history.structured_output
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
    tracker: PageTracker,
    bu_session: BrowserSession,
    params: dict,
    retries: dict,
) -> str | None:
    if step.skip_command:
        logger.debug("skip_command=true — going straight to AI")
        await run_ai_with_retry(step, bu_session)
        return None

    while True:
        page = tracker.page  # re-read every attempt — a prior attempt may have opened a new tab
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
    on_event: EventEmitter | None = None,
    run_id: str | None = None,
    port: int | None = None,
    profile_dir: str | None = None,
) -> None:
    if params is None:
        params = {}
    if on_event is None:
        on_event = noop_on_event
    if run_id is None:
        run_id = str(uuid.uuid4())

    missing = [p for p in workflow.parameters if p not in params]
    if missing:
        raise ValueError(f"Missing required parameters: {missing}")

    cdp_url = f"http://127.0.0.1:{port if port is not None else CDP_PORT}"
    proc = subprocess.Popen(
        chrome_launch_args(headless=headless, port=port, profile_dir=profile_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    await wait_for_cdp(port=port)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(cdp_url)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[-1] if context.pages else await context.new_page()
            tracker = PageTracker(context, page)

            bu_session = BrowserSession(cdp_url=cdp_url, keep_alive=True)
            await bu_session.start()

            await _emit(on_event, run_id, type="run_started")

            try:
                extract_results: list[Any] = []
                retries: dict[int, int] = {}
                for i, step in enumerate(workflow.steps):
                    logger.info("[%d/%d] %-8s  %s", i + 1, len(workflow.steps), step.type, step.instruction)
                    await _emit(
                        on_event, run_id,
                        type="step_started", step_index=i, step_type=step.type, message=step.instruction,
                        data={"instruction": step.instruction},
                    )

                    try:
                        if step.type == "wait":
                            await asyncio.sleep(step.duration)
                            await _emit(on_event, run_id, type="step_succeeded", step_index=i, step_type=step.type)

                        elif step.type == "ai":
                            healed = await run_ai_with_retry(step, bu_session)
                            if healed:
                                await _emit(
                                    on_event, run_id,
                                    type="step_healed", step_index=i, step_type=step.type,
                                    data={"command": healed},
                                )
                            else:
                                await _emit(on_event, run_id, type="step_succeeded", step_index=i, step_type=step.type)

                        elif step.type == "extract":
                            result = await run_extract(step, tracker.page)
                            extract_results.append(result)
                            await _emit(
                                on_event, run_id,
                                type="extract_result", step_index=i, step_type=step.type,
                                data={"result": result},
                            )
                            await _emit(on_event, run_id, type="step_succeeded", step_index=i, step_type=step.type)

                        else:
                            healed = await run_playwright_with_fallback(step, i, tracker, bu_session, params, retries)
                            if healed and workflow_path:
                                _patch_step_command(workflow_path, i, healed)
                                step.command = healed
                            if healed:
                                await _emit(
                                    on_event, run_id,
                                    type="step_healed", step_index=i, step_type=step.type,
                                    data={"command": healed},
                                )
                            else:
                                await _emit(on_event, run_id, type="step_succeeded", step_index=i, step_type=step.type)

                    except Exception as exc:
                        logger.warning("Step %d failed: %s", i, exc)
                        await _emit(
                            on_event, run_id,
                            type="step_failed", step_index=i, step_type=step.type,
                            data={"error": str(exc)},
                        )
                        raise

                logger.info("Workflow complete.")
                await _emit(on_event, run_id, type="run_completed", data={"extracts": extract_results})
                await bu_session.stop()
            except Exception as exc:
                logger.warning("Workflow failed: %s", exc)
                await _emit(on_event, run_id, type="run_failed", data={"error": str(exc)})
                raise
    finally:
        proc.terminate()
        proc.wait()
