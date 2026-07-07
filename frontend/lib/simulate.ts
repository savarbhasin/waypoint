import type { RunStatus, Workflow, WorkflowStep } from "@/types/workflow";
import { resolveParams } from "./params";

export interface SimEvent {
  index: number;
  status: RunStatus;
  log?: string;
}

const STEP_MS = 900;

function describe(step: WorkflowStep, params: Record<string, string>): string {
  switch (step.type) {
    case "navigate":
      return `goto ${resolveParams(step.url, params) || "(no url)"}`;
    case "click":
      return `click  ${step.command ?? "(no command)"}`;
    case "fill":
      return `fill   ${step.command ?? "(no command)"} <- "${resolveParams(step.value, params)}"`;
    case "select":
      return `select ${step.command ?? "(no command)"} -> "${resolveParams(step.value, params)}"`;
    case "scroll":
      return `scroll to (${step.scroll_x ?? 0}, ${step.scroll_y ?? 0})`;
    case "ai":
      return `agent.run("${step.task ?? step.instruction}")`;
    case "extract":
      return `extract via ${step.method ?? "screenshot"}`;
    case "wait":
      return `sleep ${step.duration}s`;
  }
}

export async function* simulateRun(
  workflow: Workflow,
  params: Record<string, string>
): AsyncGenerator<SimEvent> {
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    yield { index: i, status: "running", log: `[${i + 1}/${workflow.steps.length}] ${step.type.padEnd(8)} ${describe(step, params)}` };
    await sleep(STEP_MS);

    if (step.type === "wait") {
      yield { index: i, status: "success", log: `  slept ${step.duration}s` };
      continue;
    }
    if (step.type === "ai") {
      yield { index: i, status: "success", log: `  agent finished task` };
      continue;
    }
    if (step.type === "extract") {
      yield { index: i, status: "success", log: `  extracted via ${step.method ?? "screenshot"}` };
      continue;
    }
    if (step.skip_command) {
      yield { index: i, status: "running", log: `  skip_command=true — handing off to AI healer` };
      await sleep(STEP_MS * 0.6);
      yield { index: i, status: "healed", log: `  AI healed selector for this run` };
      continue;
    }
    yield { index: i, status: "success", log: `  ok` };
  }
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
