# Waypoint

Browser automation that records once and replays reliably — with AI fallback when pages change.

Record a workflow in the browser via the Chrome extension, enrich it with parameters and instructions in the web studio, then run it on demand. Playwright executes each step deterministically; when a locator breaks, a browser-use agent heals that step and the fix is saved for the next run.

## What you can use it for

- **Regression testing** — replay critical flows after every deploy without maintaining brittle Selenium suites
- **Back-office automation** — sync data between CRMs, spreadsheets, and internal admin tools
- **Recurring reports** — pull the same numbers from multiple dashboards on a schedule
- **Account & environment setup** — provision and configure environments the same way every time

## Quick start

### 1. Python (worker)

```bash
pip install -r requirements.txt
playwright install chromium

# API key for extraction and AI fallback
export OPENAI_API_KEY=...
```

### 2. Database (for the web studio)

```bash
docker compose up -d postgres
```

### 3. Web studio

```bash
cd frontend
cp .env.local.example .env.local   # fill in auth + DB + API keys
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google or GitHub (configure OAuth in `.env.local`).

### 4. Run worker (required for web-triggered runs)

The frontend starts runs via a FastAPI worker that executes workflows headlessly and streams events back.

```bash
uvicorn src.worker.app:app --host 0.0.0.0 --port 8787
```

Set `WORKER_URL=http://localhost:8787` in `frontend/.env.local` (default).

## Web studio

After sign-in, the app opens to a tabbed dashboard:

| Tab | Purpose |
|---|---|
| **Dashboard** | Live status — running workflows, recent failures, activity trend |
| **Workflows** | Full workflow list with search, sort, and health stats |
| **Runs** | Cross-workflow run history with filters and expandable event logs |
| **Analytics** | 30/90-day trends, success rates, and per-workflow reliability |

Workflow detail (`/w/{id}`) includes a step editor, live browser view during runs, and per-workflow run history.

**Chrome extension** — record workflows in the browser and import them via API token (`/settings/tokens`). See `extension/`.

## Architecture

```
record → enrich → run
```

**Record** — the Chrome extension (`extension/`) captures clicks, fills, selects, and navigations as Playwright locator expressions while you perform the task in a real browser.

**Enrich** — on import, the web app runs TypeScript enrichment (`frontend/lib/enrichment.ts`): OpenAI rewrites step instructions, extracts `{param}` tokens, and marks dynamic locators with `skip_command` so they route to the AI healer instead of brittle retries.

**Run** — the FastAPI worker receives workflow JSON over HTTP and Playwright executes each recorded command. On failure after `max_retries`, a browser-use agent takes over, completes the action, and returns a healed locator written back into the workflow.

### Self-healing

Healed steps surface in amber on the run timeline. The patched locator is persisted in the workflow JSON so future runs use it directly — no repeated AI cost for that step.

### Extraction

| Method | How | When |
|---|---|---|
| `selectors` | CSS selectors in workflow JSON, evaluated via Playwright | Auto-generated; $0/run |
| `screenshot` | OpenAI vision on page screenshot | Dynamic/visual content |
| `html` | OpenAI over raw page HTML | Text-heavy pages |

### Step types

`navigate` · `click` · `fill` · `select` · `scroll` · `wait` · `ai` · `extract`

## Project structure

```
src/
  models.py          Workflow, WorkflowStep (Pydantic)
  runner.py          Workflow execution + self-healing
  extractor.py       Extraction (selectors / code / LLM)
  worker/            FastAPI run worker (entry point)
  ai/                OpenAI client
  utils/             Browser helpers, locators, extraction utilities

frontend/
  app/               Next.js 15 app (landing, dashboard, workflows, runs, analytics)
  components/        UI components
  lib/               Auth, DB (Drizzle/Postgres), runs API, enrichment, analytics
  drizzle/           Database migrations

extension/           Chrome extension for workflow recording and import
workflows/           Workflow JSON files (local dev data)
```

## Stack

**Python** — Playwright, browser-use, FastAPI, Pydantic, OpenAI

**Web** — Next.js 15, React 19, Tailwind CSS 4, Drizzle ORM, Postgres, better-auth (Google/GitHub OAuth)
