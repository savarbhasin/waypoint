from __future__ import annotations
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
import uuid


StepType = Literal["navigate", "click", "fill", "select", "ai", "extract"]
ExtractMethod = Literal["screenshot", "html", "llm"]


class WorkflowStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    type: StepType
    instruction: str = ""

    # Playwright locator expression — e.g. get_by_role("button", name="Sign in")
    # Evaluated as page.<command> at runtime
    command: Optional[str] = None

    # navigate
    url: Optional[str] = None

    # fill / select
    value: Optional[str] = None          # supports {param} substitution

    # ai step
    task: Optional[str] = None

    # extract step
    method: Optional[ExtractMethod] = None
    extract_instruction: Optional[str] = None
    extraction_format: Optional[dict[str, Any]] = None  # {"field": "type", ...}

    # runtime tracking
    retry_count: int = 0
    max_retries: int = 3


class Workflow(BaseModel):
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    # Named parameters callers can pass at run time: {"username": "jdoe", ...}
    parameters: dict[str, str] = {}
    steps: list[WorkflowStep] = []

    def save(self, path: str) -> None:
        with open(path, "w") as f:
            json.dump(self.model_dump(), f, indent=2)

    @classmethod
    def load(cls, path: str) -> "Workflow":
        with open(path) as f:
            return cls.model_validate(json.load(f))
