import json
import logging

from src.ai.openai import openai
from src.models import Workflow
from src.prompts.enrich_workflow import ENRICH_SYSTEM_PROMPT
from auto_pipeline.config import strip_fences

logger = logging.getLogger(__name__)


async def enrich_workflow(workflow: Workflow, output_path: str) -> Workflow:
    raw_json = json.dumps(workflow.model_dump(), indent=2)
    response = await openai.respond(
        instructions=ENRICH_SYSTEM_PROMPT,
        user_input=f"Enrich this recorded workflow:\n\n{raw_json}",
        reasoning_effort="medium",
    )
    enriched = Workflow.model_validate(json.loads(strip_fences(response)))
    enriched.save(output_path)
    logger.info("Enriched workflow → %s", output_path)
    return enriched
