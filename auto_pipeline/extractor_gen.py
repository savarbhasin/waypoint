import json
import logging
import subprocess

from playwright.async_api import async_playwright

from src.ai.openai import openai
from src.models import Workflow, WorkflowStep
from src.utils import CDP_URL, wait_for_cdp, chrome_launch_args
from auto_pipeline.config import EXTRACTOR_GEN_PROMPT, strip_fences

logger = logging.getLogger(__name__)


async def generate_extractor(
    workflow: Workflow,
    extract_goal: str,
    extract_format: dict,
    workflow_path: str,
) -> Workflow:
    final_url = next((s.url for s in reversed(workflow.steps) if s.type == "navigate"), None)
    if not final_url:
        logger.warning("No navigate step found — cannot generate extractor")
        return workflow

    logger.info("Navigating to final page: %s", final_url)

    proc = subprocess.Popen(chrome_launch_args(headless=True), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto(final_url, wait_until="domcontentloaded")
            html = await page.content()

            logger.info("Generating CSS selectors via OpenAI...")
            raw = strip_fences(await openai.respond(
                instructions=EXTRACTOR_GEN_PROMPT.format(
                    goal=extract_goal,
                    fmt=json.dumps(extract_format, indent=2),
                ),
                user_input=f"```html\n{html[:60000]}\n```",
                reasoning_effort="medium",
            ))
            selectors: dict[str, str] = json.loads(raw)

            logger.info("Testing selectors on live page...")
            result = {}
            for field, selector in selectors.items():
                el = await page.query_selector(selector)
                if el is None:
                    raise ValueError(f"Selector for {field!r} not found: {selector!r}")
                tag = (await el.get_attribute("tagName") or "").lower()
                if tag in ("input", "textarea", "select"):
                    result[field] = await el.get_attribute("value") or ""
                else:
                    result[field] = (await el.inner_text()).strip()

            logger.info("Selector test passed: %s", json.dumps(result)[:300])

            for key in extract_format:
                if key not in result:
                    raise ValueError(f"Selector missing field: {key!r}")
    finally:
        proc.terminate()
        proc.wait()

    workflow.steps.append(WorkflowStep(
        type="extract",
        instruction=extract_goal,
        method="selectors",
        extraction_selectors=selectors,
        extract_instruction=extract_goal,
        extraction_format=extract_format,
    ))
    workflow.save(workflow_path)
    logger.info("Workflow updated with selector extract step → %s", workflow_path)
    return workflow
