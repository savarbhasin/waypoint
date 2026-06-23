import asyncio
import json
import logging

from playwright.async_api import Page

from src.ai.anthropic import anthropic
from src.models import WorkflowStep
from src.utils import load_extractor_fn, screenshot_b64, parse_llm_result

logger = logging.getLogger(__name__)


async def run_extract(step: WorkflowStep, page: Page) -> dict | str:
    if step.sleep_before:
        await asyncio.sleep(step.sleep_before)
    if step.method == "selectors":
        return await extract_by_selectors(step, page)
    if step.method == "code":
        return await extract_by_code_with_fallback(step, page)
    return await extract_by_llm(step, page)


async def extract_by_selectors(step: WorkflowStep, page: Page) -> dict:
    selectors = step.extraction_selectors or {}
    result = {}
    for field, selector in selectors.items():
        el = await page.query_selector(selector)
        if el is None:
            raise ValueError(f"Selector not found for {field!r}: {selector!r}")
        tag = (await el.get_attribute("tagName") or "").lower()
        if tag in ("input", "textarea", "select"):
            result[field] = await el.get_attribute("value") or ""
        else:
            result[field] = (await el.inner_text()).strip()
    logger.info("Selector extraction succeeded: %s", list(result.keys()))
    return result


async def extract_by_code_with_fallback(step: WorkflowStep, page: Page) -> dict | str:
    if not step.extractor_fn:
        logger.warning("method=code but no extractor_fn set — falling back to LLM")
        return await extract_by_llm(step, page, force_screenshot=True)

    fn = load_extractor_fn(step.extractor_fn)
    html = await page.content()

    for attempt in range(1, step.max_retries + 1):
        try:
            result = fn(html)
            if result is not None:
                logger.info("code extraction succeeded (attempt %d)", attempt)
                return result
            logger.warning("code attempt %d returned None", attempt)
        except Exception as exc:
            logger.warning("code attempt %d raised: %s", attempt, exc)
        if attempt < step.max_retries:
            await asyncio.sleep(1)

    logger.warning("code extraction failed — falling back to LLM (screenshot)")
    return await extract_by_llm(step, page, force_screenshot=True)


async def extract_by_llm(step: WorkflowStep, page: Page, force_screenshot: bool = False) -> dict | str:
    method = "screenshot" if force_screenshot else (step.method or "screenshot")
    instruction = step.extract_instruction or step.instruction

    schema_directive = (
        "Return ONLY a valid JSON object with exactly these fields "
        f"(no explanation, no markdown):\n{json.dumps(step.extraction_format, indent=2)}"
    )

    if method == "html":
        html = await page.content()
        raw = await anthropic.complete(f"{instruction}{schema_directive}\n\n```html\n{html}\n```")
    else:
        b64 = await screenshot_b64(page)
        raw = await anthropic.vision(b64, f"{instruction}{schema_directive}")

    return parse_llm_result(raw, step.extraction_format)
