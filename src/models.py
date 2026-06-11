from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

StepType = Literal["navigate", "click", "fill", "select", "ai", "extract", "wait"]
ExtractMethod = Literal["code", "screenshot", "html", "llm"]


class WorkflowStep(BaseModel):
    id: int = 0
    type: StepType
    instruction: str = ""
    command: Optional[str] = None
    url: Optional[str] = None
    value: Optional[str] = None
    task: Optional[str] = None
    method: Optional[ExtractMethod] = None
    extractor_fn: Optional[str] = None
    extract_instruction: Optional[str] = None
    extraction_format: Optional[dict[str, Any]] = None
    sleep_before: float = 0
    duration: float = 0
    skip_command: bool = False
    max_retries: int = 3


class Workflow(BaseModel):
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    parameters: list[str] = []
    steps: list[WorkflowStep] = []

    def save(self, path: str) -> None:
        with open(path, "w") as f:
            json.dump(self.model_dump(exclude_none=True, exclude_defaults=True), f, indent=2)

    @classmethod
    def load(cls, path: str) -> Workflow:
        with open(path) as f:
            return cls.model_validate(json.load(f))
