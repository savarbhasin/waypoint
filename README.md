# workflows

AI-powered browser workflow recorder, enricher, and runner built on Playwright and browser-use.

## What it does

Record a browser workflow once (manually or via AI agent), enrich it with parameters and instructions, then replay it deterministically — with self-healing selectors when pages change.

## Architecture

```
record → enrich → run
```

**Record** — Captures browser interactions via `capture.js` injected into every page. Tracks clicks, fills, selects, scrolls, and navigations. AI recording mode uses a browser-use agent that drives the browser and returns a structured, deduplicated step list.

**Enrich** — Sends the raw workflow JSON to OpenAI with a reasoning pass: rewrites instructions, extracts `{param}` tokens, sets `skip_command` on dynamic locators.

**Run** — Executes steps deterministically with Playwright. On failure, hands off to a browser-use agent which completes the action and returns a healed selector. The healed selector is patched back into the workflow JSON so future runs cost $0 on that step again.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env  # add OPENAI_API_KEY, ANTHROPIC_API_KEY
```

## Usage

```bash
# Record a workflow manually (opens Chrome)
python src/main.py record --output workflows/my_workflow.json --name my_workflow

# Enrich a recorded workflow
python src/main.py process workflows/my_workflow.json

# Run a workflow
python src/main.py run workflows/my_workflow.json --param username=jdoe --param password=secret

# Run headlessly
python src/main.py run workflows/my_workflow.json --headless
```

## Auto Pipeline

`auto_pipeline/` is a fully automated record → enrich → extract pipeline for a target site.

```bash
python -m auto_pipeline.pipeline
```

Stages:
1. **AI Recording** — browser-use agent drives the browser, returns a minimal structured step list via `output_model`
2. **Enrichment** — OpenAI rewrites and parameterizes the workflow
3. **Extractor Generation** — LLM generates CSS selectors for each extraction field; selectors are tested on the live page and stored in the workflow (no code generation, no `exec()`)

## Extraction

Three modes, selected per step via `method`:

| Method | How it works | When to use |
|---|---|---|
| `selectors` | CSS selectors stored in workflow, evaluated via Playwright | Auto-generated; language-agnostic; $0/run |
| `screenshot` | Claude vision on a page screenshot | Dynamic/visual content |
| `html` | Claude over raw page HTML | Text-heavy pages |

## Self-healing

When a Playwright step fails after `max_retries`, a browser-use agent takes over with `output_model=HealedSelector`. The agent completes the action and returns the Playwright locator it used. That locator is written back into the workflow JSON immediately — the next run uses it directly.

## Workflow step types

`navigate` `click` `fill` `select` `scroll` `wait` `ai` `extract`

## Project structure

```
src/
  main.py          — CLI entry point
  models.py        — Workflow, WorkflowStep (Pydantic)
  recorder.py      — Human recording via capture.js
  runner.py        — Workflow execution + self-healing
  extractor.py     — Extraction (selectors / code / LLM)
  ai/
    openai.py      — OpenAI client (enrichment, selector gen)
    anthropic.py   — Anthropic client (vision extraction)
  utils/           — Browser helpers, param resolution, locators
  scripts/
    capture.js     — Injected into pages to capture browser events
  prompts/
    enrich_workflow.py

auto_pipeline/
  pipeline.py      — Orchestrator (record → enrich → extract)
  record.py        — AI agent recording with structured output
  enrich.py        — Workflow enrichment
  extractor_gen.py — CSS selector generation
  config.py        — Constants, prompts, helpers
  runner.py        — Scheduled recurring execution
```
