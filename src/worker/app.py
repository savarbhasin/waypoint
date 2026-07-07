import asyncio
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from src.events import RunEvent
from src.models import Workflow
from src.worker.manager import RunManager
from src.worker.run_entrypoint import execute
from src.worker.schemas import RunRequest, RunResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI()
# TODO: no auth yet — tighten allow_origins once auth is introduced.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

manager = RunManager()


@app.post("/runs", status_code=201)
async def create_run(body: RunRequest) -> RunResponse:
    try:
        workflow = Workflow(**body.workflow)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid workflow: {exc}") from exc

    missing = [p for p in workflow.parameters if p not in body.params]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required parameters: {missing}")

    run_id = manager.create()
    task = asyncio.create_task(execute(run_id, workflow, body.params, manager))
    manager.attach_task(run_id, task)
    return RunResponse(run_id=run_id)


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict:
    snapshot = manager.get_snapshot(run_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="run not found")
    return snapshot


@app.websocket("/runs/{run_id}/stream")
async def stream_run(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    subscription = manager.subscribe(run_id)
    if subscription is None:
        await websocket.send_text(
            RunEvent(run_id=run_id, type="run_failed", data={"error": "not found"}).model_dump_json()
        )
        await websocket.close()
        return

    history, queue = subscription
    try:
        for event in history:
            await websocket.send_text(event.model_dump_json())
            if event.type in ("run_completed", "run_failed"):
                return

        while True:
            event = await queue.get()
            await websocket.send_text(event.model_dump_json())
            if event.type in ("run_completed", "run_failed"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.unsubscribe(run_id, queue)


@app.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict:
    manager.cancel(run_id)
    return {"ok": True}
