import type { StepType } from "@/types/workflow";

export interface CodeRef {
  file: string;
  lines: string;
  symbol: string;
  summary: string;
}

export const PIPELINE_REFS: Record<"record" | "process" | "run", CodeRef> = {
  record: {
    file: "src/recorder.py",
    lines: "32–109",
    symbol: "record()",
    summary: "Injects capture.js, listens for clicks/fills/navigations, saves raw Workflow JSON.",
  },
  process: {
    file: "src/utils/enricher.py",
    lines: "13–23",
    symbol: "enrich()",
    summary: "Sends workflow to OpenAI; extracts parameters, rewrites instructions, sets skip_command.",
  },
  run: {
    file: "src/runner.py",
    lines: "110–157",
    symbol: "run_workflow()",
    summary: "Launches Chrome on CDP :9222, replays steps via Playwright, hands off to AI on failure.",
  },
};

export const STEP_REFS: Record<StepType, CodeRef> = {
  navigate: {
    file: "src/runner.py",
    lines: "73–74",
    symbol: "page.goto()",
    summary: "Resolves {param} tokens in url, navigates with wait_until=domcontentloaded.",
  },
  click: {
    file: "src/runner.py",
    lines: "76–79",
    symbol: "loc.click()",
    summary: "Evaluates step.command as a Playwright locator, waits for visible, clicks.",
  },
  fill: {
    file: "src/runner.py",
    lines: "81–84",
    symbol: "loc.fill()",
    summary: "Evaluates locator, fills with resolved value (supports {param} substitution).",
  },
  select: {
    file: "src/runner.py",
    lines: "86–89",
    symbol: "loc.select_option()",
    summary: "Evaluates locator, selects option with resolved value.",
  },
  scroll: {
    file: "src/runner.py",
    lines: "91–92",
    symbol: "page.evaluate(scrollTo)",
    summary: "Scrolls to scroll_x / scroll_y via window.scrollTo.",
  },
  ai: {
    file: "src/runner.py",
    lines: "34–55",
    symbol: "run_ai_with_retry()",
    summary: "browser-use Agent runs the task; returns healed Playwright locator on success.",
  },
  extract: {
    file: "src/extractor.py",
    lines: "14–21",
    symbol: "run_extract()",
    summary: "Routes to selectors, code, or LLM extraction depending on step.method.",
  },
  wait: {
    file: "src/runner.py",
    lines: "138–139",
    symbol: "asyncio.sleep()",
    summary: "Sleeps for step.duration seconds before continuing.",
  },
};

export const MODEL_REF: CodeRef = {
  file: "src/models.py",
  lines: "13–47",
  symbol: "Workflow / WorkflowStep",
  summary: "Pydantic models — the JSON schema this UI mirrors exactly.",
};

export const PARAMS_REF: CodeRef = {
  file: "src/utils/params.py",
  lines: "8–11",
  symbol: "resolve_params()",
  summary: "Substitutes {param_name} tokens in url and value fields at run time.",
};

export const CAPTURE_REF: CodeRef = {
  file: "src/scripts/capture.js",
  lines: "1–end",
  symbol: "__recordAction",
  summary: "Injected into every page; fires callbacks for clicks, fills, and selects.",
};

export const ARCHITECTURE_FILES: CodeRef[] = [
  MODEL_REF,
  { file: "src/main.py", lines: "23–57", symbol: "main()", summary: "CLI entry — record, process, run subcommands." },
  PIPELINE_REFS.record,
  CAPTURE_REF,
  PIPELINE_REFS.process,
  { file: "src/prompts/enrich_workflow.py", lines: "1–44", symbol: "ENRICH_SYSTEM_PROMPT", summary: "System prompt the LLM uses during enrichment." },
  PIPELINE_REFS.run,
  { file: "src/utils/browser.py", lines: "15–27", symbol: "chrome_launch_args()", summary: "Launches Chrome with --remote-debugging-port=9222." },
  PARAMS_REF,
  { file: "src/extractor.py", lines: "14–80", symbol: "run_extract()", summary: "Selector, code, screenshot, and HTML extraction paths." },
  { file: "src/ai/openai.py", lines: "10–17", symbol: "openai.respond()", summary: "GPT-5.2 via Responses API — used for enrichment." },
  { file: "src/ai/anthropic.py", lines: "16–27", symbol: "anthropic.vision()", summary: "Claude Sonnet — used for screenshot/HTML extraction." },
];
