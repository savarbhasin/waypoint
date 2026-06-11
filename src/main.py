#!/usr/bin/env python3
import argparse
import asyncio
import logging
from pathlib import Path

from dotenv import load_dotenv
from browser_use import ChatAnthropic
from utils.enricher import enrich
from models import Workflow
from recorder import record
from runner import run_workflow

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    parser = argparse.ArgumentParser(description="Browser AI Playwright — workflow recorder & runner")
    sub = parser.add_subparsers(dest="command", required=True)

    rec = sub.add_parser("record", help="Record a new workflow by interacting with the browser")
    rec.add_argument("--output", "-o", default="workflows/recorded.json", help="Output JSON path")
    rec.add_argument("--name", "-n", default="recorded_workflow", help="Workflow name")

    proc_p = sub.add_parser("process", help="Enrich a recorded workflow: params, instructions, skip_command")
    proc_p.add_argument("file", help="Path to workflow JSON")
    proc_p.add_argument("--output", "-o", default=None, help="Output path (default: overwrite in place)")

    run_p = sub.add_parser("run", help="Run a workflow JSON file")
    run_p.add_argument("file", help="Path to workflow JSON")
    run_p.add_argument("--headless", action="store_true", help="Run browser headlessly")
    run_p.add_argument("--param", "-p", action="append", metavar="KEY=VALUE",
                       help="Override a workflow parameter, e.g. --param username=jdoe")

    args = parser.parse_args()

    if args.command == "record":
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        asyncio.run(record(output_path=args.output, name=args.name))

    elif args.command == "process":
        wf = Workflow.load(args.file)
        out = args.output or args.file
        logger.info(f"Enriching workflow: {wf.name!r}  ({len(wf.steps)} steps)")
 
        await enrich(wf, out)

    elif args.command == "run":
        wf = Workflow.load(args.file)
        cli_params = {}
        for kv in (args.param or []):
            k, _, v = kv.partition("=")
            cli_params[k.strip()] = v.strip()
        logger.info("Running workflow: %r  (%d steps)", wf.name, len(wf.steps))
        await run_workflow(wf, headless=args.headless, params=cli_params)


if __name__ == "__main__":
    asyncio.run(main())
