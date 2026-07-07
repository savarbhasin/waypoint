import type { Workflow, WorkflowStep } from "@/types/workflow";
import { STEP_DEFAULTS } from "@/types/workflow";

function trimStep(step: WorkflowStep): Record<string, unknown> {
  const out: Record<string, unknown> = { type: step.type };
  for (const [key, value] of Object.entries(step)) {
    if (key === "type") continue;
    if (value === undefined || value === null) continue;
    const defaultValue = (STEP_DEFAULTS as Record<string, unknown>)[key];
    if (defaultValue !== undefined && value === defaultValue) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export function toExportJson(workflow: Workflow): string {
  const payload = {
    name: workflow.name,
    description: workflow.description,
    created_at: workflow.created_at,
    parameters: workflow.parameters,
    steps: workflow.steps.map(trimStep),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadWorkflow(workflow: Workflow): void {
  const blob = new Blob([toExportJson(workflow)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${workflow.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
