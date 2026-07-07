# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Three-stage pipeline: **record → enrich → run**

### Data model (`src/models.py`)
`Workflow` holds metadata and a list of `WorkflowStep` objects (Pydantic). Step types: `navigate`, `click`, `fill`, `select`, `ai`, `extract`, `wait`. Workflows are stored as JSON in Postgres (web studio) and passed to the worker in HTTP request bodies.

Parameter substitution uses `{param_name}` tokens in step `value` and `url` fields. `Workflow.parameters` lists the names that must be supplied at runtime.

### Recording & enrichment
Recording happens via the Chrome extension (`extension/content.js`), which captures browser actions as Playwright locator expressions. On import, the web app enriches raw workflows in TypeScript (`frontend/lib/enrichment.ts`): OpenAI rewrites instructions, extracts parameters, substitutes `{param_name}` tokens, and sets `skip_command: true` on steps with dynamic locators.

### Worker (`src/worker/app.py`)
Entry point: `uvicorn src.worker.app:app`. Receives workflow JSON directly over HTTP (no file I/O).

Routes:
- `POST /runs` — start a run (workflow JSON + params in body)
- `GET /runs/{run_id}` — run snapshot
- `WS /runs/{run_id}/stream` — live event stream
- `POST /runs/{run_id}/cancel` — cancel a run

### Runner (`src/runner.py`)
Launches Chrome directly via `subprocess` on CDP port 9222 (`src/utils/browser.py`), then connects Playwright and `browser-use` `BrowserSession` to the same instance.

Execution per step:
- `wait` → `asyncio.sleep`
- `ai` → `browser-use` Agent (3 retries)
- `extract` → `src/extractor.py`
- everything else → `run_playwright_with_fallback`: attempts the Playwright command up to `step.max_retries` times; on exhaustion hands off to `browser-use` Agent. Steps with `skip_command: true` bypass Playwright entirely.

Locators in `step.command` are Playwright expressions evaluated with `eval()` (e.g. `page.get_by_role("button", name="Submit")`).

### Extractor (`src/extractor.py`)
Handles `extract` steps. Two paths:
- `method=code`: loads `step.extractor_fn` (dotted path, e.g. `mymodule.my_fn`) dynamically, passes raw HTML, falls back to LLM on failure.
- All other methods (default `screenshot`, `html`): calls OpenAI vision or text completion with `step.extract_instruction` and `step.extraction_format`.

### AI clients (`src/ai/`)
- `openai.py` — OpenAI `gpt-5.2` via Responses API (`reasoning` parameter). Used for extraction (text + vision).

Module-level singleton: `openai`.

## Code style

- No leading underscores on function names; use clear, descriptive names
- Import modules at the top of each file only
- Avoid docstrings unless non-obvious; one short line max
- JS/scripts go in separate files, not inline in Python strings
- System prompts in separate files or constants, not inline
- Create classes when encapsulation helps; avoid files with too many unrelated functions
- `optexity/` is reference only — consult it for architectural decisions, do not modify it
- CLEAN MODULAR BEAUTIFUL CODE
