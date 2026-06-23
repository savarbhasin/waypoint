import asyncio
import logging

from auto_pipeline.config import (
    TASK_URL, TASK_GOAL, WORKFLOW_NAME, WORKFLOW_PATH,
    EXTRACT_GOAL, EXTRACT_FORMAT, load_sensitive_data,
)
from auto_pipeline.record import ai_record
from auto_pipeline.enrich import enrich_workflow
from auto_pipeline.extractor_gen import generate_extractor

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)


async def main():
    sensitive_data = load_sensitive_data()

    logger.info("=== Stage 1: AI Recording ===")
    workflow = await ai_record(TASK_URL, TASK_GOAL, WORKFLOW_NAME, sensitive_data=sensitive_data)
    logger.info("Recorded %d steps", len(workflow.steps))

    logger.info("=== Stage 2: Enrichment ===")
    workflow = await enrich_workflow(workflow, WORKFLOW_PATH)

    logger.info("=== Stage 3: Generate Extractor ===")
    workflow = await generate_extractor(workflow, EXTRACT_GOAL, EXTRACT_FORMAT, WORKFLOW_PATH)

    logger.info("=== Pipeline complete ===")
    logger.info("Workflow: %s", WORKFLOW_PATH)
    for i, step in enumerate(workflow.steps, start=1):
        logger.info("  [%d] %-10s %s", i, step.type, step.instruction)


if __name__ == "__main__":
    asyncio.run(main())
