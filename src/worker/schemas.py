from typing import Any

from pydantic import BaseModel


class RunRequest(BaseModel):
    workflow: dict[str, Any]
    params: dict[str, str] = {}


class RunResponse(BaseModel):
    run_id: str
