import asyncio
import signal
import time
from pathlib import Path

from playwright.async_api import async_playwright

from src.models import Workflow, WorkflowStep

NAV_DEBOUNCE_AFTER_CLICK = 1.5

CAPTURE_SCRIPT = (Path(__file__).parent / "capture.js").read_text()


def build_instruction(step: dict) -> str:
    t = step.get("type")
    label = step.get("label") or "element"
    if t == "navigate":
        return f"Navigate to {step.get('url', '')}"
    if t == "click":
        return f"Click '{label}'"
    if t == "fill":
        return f"Fill '{label}' with '{step.get('value', '')}'"
    if t == "select":
        return f"Select '{step.get('value', '')}' in '{label}'"
    return ""


async def record(output_path: str, name: str = "recorded_workflow") -> None:
    steps: list[dict] = []
    last_click_time: list[float] = [0.0]
    last_click_navigates: list[bool] = [False]
    done = asyncio.Event()

    def on_action(action: dict) -> None:
        if action.get("type") == "click":
            last_click_time[0] = time.monotonic()
            last_click_navigates[0] = bool(action.get("click_navigates"))
        if action.get("type") == "fill":
            for i in range(len(steps) - 1, -1, -1):
                if steps[i].get("type") == "fill" and steps[i].get("command") == action.get("command"):
                    steps[i] = action
                    print(f"  [{i+1:02d}] fill     (updated) {build_instruction(action)}")
                    return
        steps.append(action)
        print(f"  [{len(steps):02d}] {action['type']:8s}  {build_instruction(action)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=False,
            args=["--no-first-run", "--no-default-browser-check"],
        )
        context = await browser.new_context()
        page = await context.new_page()

        loop = asyncio.get_event_loop()
        await context.expose_function("__recordAction", on_action)
        await context.expose_function("__stopRecording", lambda: loop.call_soon_threadsafe(done.set))
        await context.add_init_script(CAPTURE_SCRIPT)
        await page.evaluate(CAPTURE_SCRIPT)

        last_url = ""

        def on_frame_navigated(frame):
            nonlocal last_url
            if frame != page.main_frame:
                return
            url = frame.url
            if url in ("about:blank", last_url) or url.startswith("about:"):
                return
            elapsed = time.monotonic() - last_click_time[0]
            if last_click_navigates[0] or elapsed < NAV_DEBOUNCE_AFTER_CLICK:
                last_click_navigates[0] = False
                last_url = url
                return
            last_url = url
            steps.append({"type": "navigate", "url": url})
            print(f"  [{len(steps):02d}] navigate  Navigate to {url}")

        page.on("framenavigated", on_frame_navigated)
        loop.add_signal_handler(signal.SIGINT, lambda: done.set())

        print("\nBrowser is open. Perform your actions.")
        print("Click '⏹ Stop Recording' in the browser, or press Ctrl+C to save.\n")

        await done.wait()
        loop.remove_signal_handler(signal.SIGINT)

        try:
            await browser.close()
        except Exception:
            pass

    workflow = Workflow(name=name)
    for s in steps:
        workflow.steps.append(WorkflowStep(
            type=s["type"],
            instruction=build_instruction(s),
            command=s.get("command"),
            url=s.get("url"),
            value=s.get("value"),
        ))

    workflow.save(output_path)
    print(f"\nSaved {len(workflow.steps)} steps to {output_path}")
