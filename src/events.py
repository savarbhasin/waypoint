from datetime import datetime
from typing import Any, Awaitable, Callable, Literal, Optional

from pydantic import BaseModel, Field

EventType = Literal[
    "run_started",
    "step_started",
    "step_succeeded",
    "step_healed",
    "step_failed",
    "extract_result",
    "frame",
    "run_completed",
    "run_failed",
]


class RunEvent(BaseModel):
    type: EventType
    run_id: str
    step_index: Optional[int] = None
    step_type: Optional[str] = None
    message: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


EventEmitter = Callable[[RunEvent], Awaitable[None]]
