import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Literal

from src.events import RunEvent

RunStatus = Literal["running", "completed", "failed"]

TERMINAL_EVENT_TYPES = ("run_completed", "run_failed")


@dataclass
class RunHandle:
    run_id: str
    status: RunStatus = "running"
    history: list[RunEvent] = field(default_factory=list)
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    task: asyncio.Task | None = None


class RunManager:
    def __init__(self) -> None:
        self._runs: dict[str, RunHandle] = {}

    def create(self) -> str:
        run_id = str(uuid.uuid4())
        self._runs[run_id] = RunHandle(run_id=run_id)
        return run_id

    def attach_task(self, run_id: str, task: asyncio.Task) -> None:
        handle = self._runs.get(run_id)
        if handle is not None:
            handle.task = task

    async def emit(self, run_id: str, event: RunEvent) -> None:
        handle = self._runs.get(run_id)
        if handle is None:
            return
        handle.history.append(event)
        if event.type in TERMINAL_EVENT_TYPES:
            handle.status = "completed" if event.type == "run_completed" else "failed"
        for queue in handle.subscribers:
            if event.type == "frame":
                drop_stale_frames(queue)
            queue.put_nowait(event)

    def subscribe(self, run_id: str) -> tuple[list[RunEvent], asyncio.Queue] | None:
        handle = self._runs.get(run_id)
        if handle is None:
            return None
        queue: asyncio.Queue = asyncio.Queue()
        handle.subscribers.append(queue)
        return list(handle.history), queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        handle = self._runs.get(run_id)
        if handle is None:
            return
        if queue in handle.subscribers:
            handle.subscribers.remove(queue)

    def get_snapshot(self, run_id: str) -> dict | None:
        handle = self._runs.get(run_id)
        if handle is None:
            return None
        return {"status": handle.status, "history": list(handle.history)}

    def cancel(self, run_id: str) -> bool:
        handle = self._runs.get(run_id)
        if handle is None or handle.task is None:
            return False
        if not handle.task.done():
            handle.task.cancel()
        return True


def drop_stale_frames(queue: asyncio.Queue) -> None:
    """Drain the queue and re-enqueue only non-frame events, so frames never pile up for a slow subscriber."""
    kept = []
    while not queue.empty():
        try:
            item = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        if item.type != "frame":
            kept.append(item)
    for item in kept:
        queue.put_nowait(item)
