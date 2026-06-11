import json
import re

from src.ai.openai import openai
from src.models import Workflow
from src.prompts.enrich_workflow import ENRICH_SYSTEM_PROMPT



async def enrich(workflow: Workflow) -> Workflow:
    raw_json = json.dumps(workflow.model_dump(), indent=2)
    response_text = await openai.respond(
        instructions=ENRICH_SYSTEM_PROMPT,
        user_input=f"Enrich this recorded workflow:\n\n{raw_json}",
    )
    response_text = re.sub(r'^```json\s*', '', response_text)
    response_text = re.sub(r'\s*```$', '', response_text)

    enriched = Workflow.model_validate(json.loads(response_text))
    for i, step in enumerate(enriched.steps, start=1):
        step.id = i

    return enriched
