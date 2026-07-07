import asyncio
import contextlib
import logging
import shutil
import tempfile

from playwright.async_api import Page, async_playwright

from src.events import RunEvent
from src.live_view import LiveView
from src.models import Workflow
from src.runner import run_workflow
from src.tabs import PageTracker
from src.utils import find_free_port, wait_for_cdp
from src.worker.manager import RunManager

logger = logging.getLogger(__name__)


async def ensure_terminal_event(manager: RunManager, run_id: str, error: str) -> None:
    """Safety net for when run_workflow raises before emitting its own terminal event."""
    snapshot = manager.get_snapshot(run_id)
    if snapshot is not None and snapshot["status"] == "running":
        with contextlib.suppress(Exception):
            await manager.emit(run_id, RunEvent(run_id=run_id, type="run_failed", data={"error": error}))


async def execute(run_id: str, workflow: Workflow, params: dict, manager: RunManager) -> None:
    port = find_free_port()
    profile_dir = tempfile.mkdtemp(prefix=f"cdp-run-{run_id}-")

    async def on_event(event: RunEvent) -> None:
        await manager.emit(run_id, event)

    async def on_frame(image_b64: str) -> None:
        await manager.emit(run_id, RunEvent(run_id=run_id, type="frame", data={"image": image_b64, "format": "jpeg"}))

    # The worker always runs headless — the live view (CDP screencast) is how a
    # client watches the run, not a visible window on the worker's machine.
    run_task = asyncio.create_task(
        run_workflow(
            workflow,
            headless=True,
            params=params,
            on_event=on_event,
            run_id=run_id,
            port=port,
            profile_dir=profile_dir,
        )
    )

    live_view: LiveView | None = None
    playwright_ctx = None

    async def switch_live_view(new_page: Page) -> None:
        nonlocal live_view
        if live_view is not None:
            with contextlib.suppress(Exception):
                await live_view.stop()
        live_view = LiveView(new_page, on_frame)
        with contextlib.suppress(Exception):
            await live_view.start()

    try:
        try:
            await wait_for_cdp(port=port)
            playwright_ctx = await async_playwright().start()
            browser = await playwright_ctx.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[-1] if context.pages else await context.new_page()
            live_view = LiveView(page, on_frame)
            await live_view.start()
            # Follow whichever tab the workflow switches to (e.g. a click that opens
            # a new tab) so the live view never gets stuck on a stale/backgrounded page.
            PageTracker(context, page, on_active_change=switch_live_view)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Live view unavailable for run %s: %s", run_id, exc)

        await run_task
    except asyncio.CancelledError:
        run_task.cancel()
        with contextlib.suppress(Exception, asyncio.CancelledError):
            await run_task
        await ensure_terminal_event(manager, run_id, "cancelled")
        raise
    except Exception as exc:
        logger.warning("run_workflow raised for run %s: %s", run_id, exc)
        await ensure_terminal_event(manager, run_id, str(exc))
    finally:
        if live_view is not None:
            with contextlib.suppress(Exception):
                await live_view.stop()
        if playwright_ctx is not None:
            with contextlib.suppress(Exception):
                await playwright_ctx.stop()
        shutil.rmtree(profile_dir, ignore_errors=True)
