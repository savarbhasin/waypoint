#!/usr/bin/env python3
"""
CLI entry point.

Usage:
  python main.py record [--output workflows/my_workflow.json] [--name "My Workflow"]
  python main.py run workflows/my_workflow.json [--headless]
"""
import argparse
import asyncio
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Browser AI Playwright — workflow recorder & runner")
    sub = parser.add_subparsers(dest="command", required=True)

    # record
    rec = sub.add_parser("record", help="Record a new workflow by interacting with the browser")
    rec.add_argument("--output", "-o", default="workflows/recorded.json", help="Output JSON path")
    rec.add_argument("--name", "-n", default="recorded_workflow", help="Workflow name")

    # run
    run_p = sub.add_parser("run", help="Run a workflow JSON file")
    run_p.add_argument("file", help="Path to workflow JSON")
    run_p.add_argument("--headless", action="store_true", help="Run browser headlessly")
    run_p.add_argument("--param", "-p", action="append", metavar="KEY=VALUE",
                       help="Override a workflow parameter, e.g. --param username=jdoe")

    args = parser.parse_args()

    if args.command == "record":
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        from recorder import record
        asyncio.run(record(output_path=args.output, name=args.name))

    elif args.command == "run":
        from workflow import Workflow
        from runner import run_workflow
        wf = Workflow.load(args.file)
        cli_params = {}
        for kv in (args.param or []):
            k, _, v = kv.partition("=")
            cli_params[k.strip()] = v.strip()
        print(f"Running workflow: {wf.name!r}  ({len(wf.steps)} steps)")
        asyncio.run(run_workflow(wf, headless=args.headless, params=cli_params))


if __name__ == "__main__":
    main()
