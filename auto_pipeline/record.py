import logging
import subprocess

from browser_use import Agent, ChatOpenAI
from browser_use.browser.session import BrowserSession
from pydantic import BaseModel

from src.models import Workflow, WorkflowStep
from src.utils import CDP_URL, wait_for_cdp, chrome_launch_args
from auto_pipeline.config import BROWSER_LLM_MODEL, RECORD_GOAL_SUFFIX, build_instruction

logger = logging.getLogger(__name__)


class RecordedStep(BaseModel):
    type: str
    url: str | None = None
    command: str | None = None
    value: str | None = None
    label: str | None = None


class RecordingOutput(BaseModel):
    steps: list[RecordedStep]


async def ai_record(url: str, goal: str, workflow_name: str, sensitive_data: dict | None = None) -> Workflow:
    if sensitive_data is None:
        sensitive_data = {}

    proc = subprocess.Popen(chrome_launch_args(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await wait_for_cdp()

    try:
        browser_llm = ChatOpenAI(model=BROWSER_LLM_MODEL, temperature=0.2)
        bu_session = BrowserSession(cdp_url=CDP_URL, keep_alive=True)
        await bu_session.start()

        logger.info("Agent starting. Goal: %s", goal)
        agent = Agent(
            task=goal + RECORD_GOAL_SUFFIX,
            llm=browser_llm,
            browser_session=bu_session,
            sensitive_data=sensitive_data,
            output_model=RecordingOutput,
        )
        history = await agent.run()
        logger.info("Agent done=%s", history.is_done())
        result: RecordingOutput = history.final_result()

        await bu_session.stop()
    finally:
        proc.terminate()
        proc.wait()

    logger.info("Agent output %d steps", len(result.steps))

    workflow = Workflow(name=workflow_name)
    for s in result.steps:
        workflow.steps.append(WorkflowStep(
            type=s.type,
            instruction=build_instruction(s.model_dump()),
            command=s.command,
            url=s.url,
            value=s.value,
        ))
    return workflow
