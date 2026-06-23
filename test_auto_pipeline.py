#!/usr/bin/env python3
"""
Automated pipeline: AI record → mechanical dedup → critique → enrich → generate extractor → run forever

Target: quotes.toscrape.com
Goal:   Navigate to Albert Einstein's author page
Extract: All quotes with their tags from the author page
"""

import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from browser_use import Agent, ChatOpenAI
from browser_use.browser.session import BrowserSession
from playwright.async_api import async_playwright

from src.ai.anthropic import anthropic
from src.ai.openai import openai
from src.models import Workflow, WorkflowStep
from src.prompts.enrich_workflow import ENRICH_SYSTEM_PROMPT
from src.utils import CDP_URL, find_chrome, wait_for_cdp, get_locator, resolve_params, chrome_launch_args

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

CAPTURE_SCRIPT = (Path(__file__).parent / "src" / "scripts" / "capture.js").read_text()
NAV_DEBOUNCE = 1.5

# ── Sensitive credentials (never logged) ──────────────────────────────────────
SENSITIVE_DATA = {
    "username":      os.environ["USERNAME"],
    "password":  os.environ["PASSWORD"],
    "challenge": os.environ["CHALLENGE"],
    "member":    os.environ["MEMBER"],
}
print(SENSITIVE_DATA)

# ── Target config ─────────────────────────────────────────────────────────────
TASK_URL = "https://www.ohcaprovider.com/hcp/provider/Home/tabid/135/Default.aspx"
TASK_GOAL = (
    "Go to https://www.ohcaprovider.com/hcp/provider/Home/tabid/135/Default.aspx. "
    "Log in with username {username} and password {password}. "
    "If a security challenge question appears, answer it with {challenge}. "
    "Once logged in, find the eligibility check section and look up member ID {member}. "
    "Stop once the eligibility results are visible on screen or you see member id error."
)
WORKFLOW_NAME = "ohca_eligibility"
WORKFLOW_PATH = "workflows/ohca_eligibility.json"
EXTRACT_GOAL = "Extract the eligibility results for the member from the current page."
EXTRACT_FORMAT = {
    "member_id":   "string — the member ID that was looked up",
    "member_name": "string — full name of the member",
    "plan":        "string — plan or coverage name",
    "effective":   "string — coverage effective date",
    "termination": "string — coverage termination date if shown, else null",
}

EXTRACTOR_DIR = Path("extractors")

# ── Prompts ───────────────────────────────────────────────────────────────────
CRITIQUE_TASK = """You are a browser automation reviewer. A workflow was recorded to achieve this goal:

GOAL: {goal}

These steps were captured:
{steps}

Your job:
1. Navigate to the starting URL and retrace the workflow to understand what each step does.
2. Identify redundant steps: consecutive duplicates on the same element, navigate steps triggered by a preceding click, or any action that doesn't contribute to the goal.
3. Return ONLY a JSON array of the steps to KEEP, with all original fields intact. No explanation, no markdown, just the JSON array."""

EXTRACTOR_GEN_PROMPT = """Write a Python extraction function for the HTML page below.

Extraction goal: {goal}
Expected output format: {fmt}

Requirements:
- Function signature: def extract(html: str) -> dict
- Use BeautifulSoup4 (bs4) for parsing
- All imports must be INSIDE the function body
- Return a dict matching the expected format exactly
- Raise ValueError if the expected data is not found

Return ONLY the raw Python function code. No explanation, no markdown, no ``` fences."""


# ── Stage helpers ─────────────────────────────────────────────────────────────

def mechanical_dedup(steps: list[dict]) -> list[dict]:
    """Collapse consecutive same-type same-locator actions (keep last)."""
    result: list[dict] = []
    for step in steps:
        if (
            result
            and step.get("type") not in ("navigate", "fill")  # fills already deduped inline
            and result[-1].get("type") == step.get("type")
            and result[-1].get("command") and step.get("command")
            and result[-1].get("command") == step.get("command")
        ):
            result[-1] = step
        else:
            result.append(step)
    return result


def build_instruction(step: dict) -> str:
    t = step.get("type")
    label = step.get("label") or "element"
    if t == "navigate":
        return f"Navigate to {step.get('url', '')}"
    if t == "click":
        return f"Click '{label}'"
    if t == "fill":
        return f"Fill '{label}'"
    if t == "select":
        return f"Select option in '{label}'"
    return ""


def strip_fences(text: str) -> str:
    text = re.sub(r'^```(?:json|python)?\s*', '', text.strip())
    return re.sub(r'\s*```$', '', text)


# ── Stage 1: AI Recording ─────────────────────────────────────────────────────

async def ai_record(url: str, goal: str, workflow_name: str, sensitive_data: dict = {}) -> Workflow:
    """
    Spin up browser-use Agent to drive the browser.
    capture.js is the sole source of truth — agent's internal trace is discarded.
    """
    steps: list[dict] = []
    last_click_time: list[float] = [0.0]
    last_click_navigates: list[bool] = [False]
    last_url = ""

    def on_action(action: dict) -> None:
        if action.get("type") == "click":
            last_click_time[0] = time.monotonic()
            last_click_navigates[0] = bool(action.get("click_navigates"))
        if action.get("type") == "fill":
            for i in range(len(steps) - 1, -1, -1):
                if steps[i].get("type") == "fill" and steps[i].get("command") == action.get("command"):
                    steps[i] = action
                    return
        steps.append(action)
        logger.info("  [capture] %s  %s", action["type"], action.get("command") or action.get("url") or "")

    proc = subprocess.Popen(chrome_launch_args(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()

            await context.expose_function("__recordAction", on_action)
            await context.expose_function("__stopRecording", lambda: None)
            await context.add_init_script(CAPTURE_SCRIPT)

            def on_frame_navigated(frame):
                nonlocal last_url
                if frame != page.main_frame:
                    return
                nav_url = frame.url
                if nav_url in ("about:blank", last_url) or nav_url.startswith("about:"):
                    return
                elapsed = time.monotonic() - last_click_time[0]
                if last_click_navigates[0] or elapsed < NAV_DEBOUNCE:
                    last_click_navigates[0] = False
                    last_url = nav_url
                    return
                last_url = nav_url
                steps.append({"type": "navigate", "url": nav_url})
                logger.info("  [capture] navigate  %s", nav_url)

            page.on("framenavigated", on_frame_navigated)

            # Seed the starting URL so capture.js is live before the agent takes over
            await page.goto(url, wait_until="domcontentloaded")
            await page.evaluate(CAPTURE_SCRIPT)

            browser_llm = ChatOpenAI(model="gpt-5.5", temperature=0.2)
            bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
            await bu_session.start()

            logger.info("Agent starting. Goal: %s", goal)
            agent = Agent(task=goal, llm=browser_llm, browser_session=bu_session, sensitive_data=sensitive_data)
            history = await agent.run()
            logger.info("Agent done=%s", history.is_done())

            await bu_session.stop()
    finally:
        proc.terminate()
        proc.wait()

    steps = mechanical_dedup(steps)
    logger.info("Captured %d steps after mechanical dedup", len(steps))

    workflow = Workflow(name=workflow_name)
    for s in steps:
        workflow.steps.append(WorkflowStep(
            type=s["type"],
            instruction=build_instruction(s),
            command=s.get("command"),
            url=s.get("url"),
            value=s.get("value"),
        ))
    return workflow


# ── Stage 2: Self-Critique ────────────────────────────────────────────────────

async def critique_steps(workflow: Workflow, goal: str, sensitive_data: dict = {}) -> Workflow:
    """Browser-use agent replays the workflow in a live browser and prunes redundant steps."""
    steps_json = json.dumps(
        [s.model_dump(exclude_none=True, exclude_defaults=True) for s in workflow.steps],
        indent=2,
    )
    task = CRITIQUE_TASK.format(goal=goal, steps=steps_json)

    proc = subprocess.Popen(chrome_launch_args(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        browser_llm = ChatOpenAI(model="gpt-5.5", temperature=0.2)
        bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
        await bu_session.start()

        agent = Agent(task=task, llm=browser_llm, browser_session=bu_session, sensitive_data=sensitive_data)
        history = await agent.run()
        result = history.final_result() or ""

        await bu_session.stop()
    finally:
        proc.terminate()
        proc.wait()

    pruned = json.loads(strip_fences(result))
    logger.info("Critique: %d → %d steps", len(workflow.steps), len(pruned))
    workflow.steps = [WorkflowStep(**s) for s in pruned]
    return workflow


# ── Stage 3: Enrichment ───────────────────────────────────────────────────────

async def enrich_workflow(workflow: Workflow, output_path: str) -> Workflow:
    """LLM adds parameters, rewrites instructions, sets skip_command flags."""
    raw_json = json.dumps(workflow.model_dump(), indent=2)
    response = await openai.respond(
        instructions=ENRICH_SYSTEM_PROMPT,
        user_input=f"Enrich this recorded workflow:\n\n{raw_json}",
        reasoning_effort="medium",
    )
    enriched = Workflow.model_validate(json.loads(strip_fences(response)))
    for i, step in enumerate(enriched.steps, start=1):
        step.id = i
    enriched.save(output_path)
    logger.info("Enriched workflow → %s", output_path)
    return enriched


# ── Stage 4: Generate Extractor ───────────────────────────────────────────────

async def generate_extractor(workflow: Workflow, extract_goal: str, extract_format: dict, workflow_path: str) -> Workflow:
    """
    Navigate to the final page, ask Anthropic to write a bs4 extractor,
    test it immediately, save it, and attach it as an extract step.
    """
    # Use the last navigate URL recorded — that's where the agent landed
    final_url = next((s.url for s in reversed(workflow.steps) if s.type == "navigate"), None)
    if not final_url:
        logger.warning("No navigate step found — cannot generate extractor")
        return workflow

    logger.info("Navigating to final page for extraction: %s", final_url)

    proc = subprocess.Popen(chrome_launch_args(headless=True), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto(final_url, wait_until="domcontentloaded")
            html = await page.content()
    finally:
        proc.terminate()
        proc.wait()

    # Generate extractor function
    logger.info("Generating bs4 extractor via OpenAI...")
    fn_code = strip_fences(await openai.respond(
        instructions=EXTRACTOR_GEN_PROMPT.format(goal=extract_goal, fmt=json.dumps(extract_format, indent=2)),
        user_input=f"```html\n{html[:60000]}\n```",
        reasoning_effort="medium",
    ))

    # Test immediately on the live HTML
    logger.info("Testing generated extractor...")
    namespace: dict = {}
    exec(fn_code, namespace)  # noqa: S102
    extract_fn = namespace.get("extract")
    if extract_fn is None:
        raise RuntimeError("Generated code has no 'extract' function")

    result = extract_fn(html)
    logger.info("Extractor test passed. Sample: %s", json.dumps(result)[:300])

    for key in extract_format:
        if key not in result:
            raise ValueError(f"Extractor output missing key: {key!r}")

    # Validate output with a second OpenAI call
    verdict = await openai.respond(
        instructions="You validate data extraction results. Reply with PASS or FAIL and one sentence explaining why.",
        user_input=(
            f"Goal: {extract_goal}\n"
            f"Expected format: {json.dumps(extract_format)}\n"
            f"Result: {json.dumps(result)[:2000]}"
        ),
    )
    logger.info("LLM validation: %s", verdict.strip())
    if verdict.strip().upper().startswith("FAIL"):
        raise RuntimeError(f"LLM validation failed: {verdict.strip()}")

    # Save extractor module
    EXTRACTOR_DIR.mkdir(exist_ok=True)
    module_name = f"{workflow.name}_extractor"
    extractor_path = EXTRACTOR_DIR / f"{module_name}.py"
    extractor_path.write_text(fn_code)
    logger.info("Extractor saved → %s", extractor_path)

    # Attach extract step to workflow
    workflow.steps.append(WorkflowStep(
        id=len(workflow.steps) + 1,
        type="extract",
        instruction=extract_goal,
        method="code",
        extractor_fn=f"extractors.{module_name}.extract",
        extract_instruction=extract_goal,
        extraction_format=extract_format,
    ))
    workflow.save(workflow_path)
    logger.info("Workflow updated with extract step → %s", workflow_path)
    return workflow


# ── Stage 5: Run Forever ──────────────────────────────────────────────────────

async def run_forever(workflow_path: str, params: dict = {}, interval_seconds: int = 300) -> None:
    """Load and run the workflow on a recurring interval. Re-reads workflow each run to pick up changes."""
    from src.runner import run_workflow

    run_count = 0
    consecutive_failures = 0

    while True:
        workflow = Workflow.load(workflow_path)
        run_count += 1
        logger.info("=== Run #%d ===", run_count)
        try:
            await run_workflow(workflow, headless=True, params=params)
            consecutive_failures = 0
        except Exception as e:
            consecutive_failures += 1
            logger.error("Run #%d failed (%d consecutive): %s", run_count, consecutive_failures, e)
            if consecutive_failures >= 3:
                logger.error("3 consecutive failures — halting. Re-record or fix the workflow.")
                break

        logger.info("Sleeping %ds until next run.", interval_seconds)
        await asyncio.sleep(interval_seconds)


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    logger.info("=== Stage 1: AI Recording ===")
    workflow = await ai_record(TASK_URL, TASK_GOAL, WORKFLOW_NAME, sensitive_data=SENSITIVE_DATA)
    logger.info("Recorded %d steps", len(workflow.steps))

    # logger.info("=== Stage 2: Self-Critique ===")
    # workflow = await critique_steps(workflow, TASK_GOAL, sensitive_data=SENSITIVE_DATA)

    logger.info("=== Stage 3: Enrichment ===")
    workflow = await enrich_workflow(workflow, WORKFLOW_PATH)

    logger.info("=== Stage 4: Generate Extractor ===")
    workflow = await generate_extractor(workflow, EXTRACT_GOAL, EXTRACT_FORMAT, WORKFLOW_PATH)

    logger.info("=== Pipeline complete ===")
    logger.info("Workflow: %s", WORKFLOW_PATH)
    logger.info("Steps:")
    for step in workflow.steps:
        logger.info("  [%d] %-10s %s", step.id, step.type, step.instruction)


if __name__ == "__main__":
    asyncio.run(main())
