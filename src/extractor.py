import asyncio
import json
import re
from typing import Any

from playwright.async_api import Page

from src.ai.anthropic import anthropic
from src.models import WorkflowStep
from src.utils import load_extractor_fn, screenshot_b64, parse_llm_result


async def run_extract(step: WorkflowStep, page: Page) -> dict | str:
    if step.sleep_before:
        await asyncio.sleep(step.sleep_before)
    if step.method == "code":
        return await extract_by_code_with_fallback(step, page)
    return await extract_by_llm(step, page)


async def extract_by_code_with_fallback(step: WorkflowStep, page: Page) -> dict | str:
    if not step.extractor_fn:
        print("  [extract] method=code but no extractor_fn set — falling back to LLM")
        return await extract_by_llm(step, page, force_screenshot=True)

    fn = load_extractor_fn(step.extractor_fn)
    html = await page.content()

    for attempt in range(1, step.max_retries + 1):
        try:
            result = fn(html)
            if result is not None:
                print(f"  [extract] code extraction succeeded (attempt {attempt})")
                return result
            print(f"  [extract] code attempt {attempt} returned None")
        except Exception as exc:
            print(f"  [extract] code attempt {attempt} raised: {exc}")
        if attempt < step.max_retries:
            await asyncio.sleep(1)

    print("  [extract] code extraction failed — falling back to LLM (screenshot)")
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
        # cleaned_html = clean_html(html)
        raw = await anthropic.complete(f"{instruction}{schema_directive}\n\n```html\n{html}\n```")

    else:
        b64 = await screenshot_b64(page)
        raw = await anthropic.vision(b64, f"{instruction}{schema_directive}")

    result = parse_llm_result(raw, step.extraction_format)
    return result




