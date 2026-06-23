# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Record a new workflow (opens Chrome, interact to capture steps)
python src/main.py record --output workflows/my_workflow.json --name my_workflow

# Enrich a recorded workflow (LLM adds parameters, instructions, skip_command)
python src/main.py process workflows/my_workflow.json

# Run a workflow
python src/main.py run workflows/my_workflow.json --param username=jdoe --param password=secret

# Run headlessly
python src/main.py run workflows/my_workflow.json --headless
```

Run from the project root. `src/main.py` is the CLI entry point; it adjusts `sys.path` so its siblings (`utils/`, `models.py`, etc.) import without a `src.` prefix. Modules *outside* `main.py` (e.g. `runner.py`, `extractor.py`) use the `src.` prefix for their imports.

## Architecture

Three-stage pipeline: **record → process → run**

### Data model (`src/models.py`)
`Workflow` holds metadata and a list of `WorkflowStep` objects (Pydantic). Step types: `navigate`, `click`, `fill`, `select`, `ai`, `extract`, `wait`. Workflows are persisted as JSON in `workflows/`.

Parameter substitution uses `{param_name}` tokens in step `value` and `url` fields. `Workflow.parameters` lists the names that must be supplied at runtime.

### Recorder (`src/recorder.py`)
Injects `src/scripts/capture.js` into every page via Playwright's `add_init_script`. The JS fires `__recordAction` callbacks for clicks/fills/selects. Navigation events are captured on `framenavigated`. Fills to the same locator collapse to the latest value. Saves a raw `Workflow` JSON when the user stops.

**AI recording mode (planned):** When an AI agent drives the browser instead of a human, capture.js is still the sole source of truth for workflow steps — the agent's internal action trace is discarded entirely. The agent's only output is "done" or "failed". Raw steps then go through two cleanup passes before enrichment:
1. **Mechanical dedup** — same-locator fills already collapse; extend this to other action types on the same locator.
2. **Timestamp-based dedup (backlog)** — actions on the same locator within a tight time window are almost certainly agent retries; collapse them to one. Implement this pass after mechanical dedup proves insufficient.

### Enricher (`src/utils/enricher.py`)
Sends the raw workflow JSON to OpenAI (via `src/ai/openai.py`) with the system prompt in `src/prompts/enrich_workflow.py`. The LLM rewrites instructions, extracts parameters, substitutes `{param_name}` tokens, and sets `skip_command: true` on steps with dynamic locators.

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
- All other methods (default `screenshot`, `html`): calls Anthropic vision or text completion with `step.extract_instruction` and `step.extraction_format`.

### AI clients (`src/ai/`)
- `openai.py` — OpenAI `gpt-5.2` via Responses API (`reasoning` parameter). Used for workflow enrichment.
- `anthropic.py` — Anthropic `claude-sonnet-4-6`. Used for extraction (text + vision).

Both are module-level singletons (`openai`, `anthropic`). Keep both clients maintained and switchable.

## Code style

- No leading underscores on function names; use clear, descriptive names
- Import modules at the top of each file only
- Avoid docstrings unless non-obvious; one short line max
- JS/scripts go in separate files, not inline in Python strings (exception: recorder injection script — keep it in `recorder.py` for now until it grows)
- System prompts in separate files or constants, not inline
- Maintain both OpenAI and Anthropic clients so they're switchable; define clients in a dedicated module
- Create classes when encapsulation helps; avoid files with too many unrelated functions
- `optexity/` is reference only — consult it for architectural decisions, do not modify it
- CLEAN MODULAR BEAUTIFUL CODE
