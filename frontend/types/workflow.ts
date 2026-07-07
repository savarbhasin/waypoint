// Mirrors src/models.py exactly so JSON exported here loads with Workflow.load() unmodified.

export type StepType = "navigate" | "click" | "fill" | "select" | "scroll" | "ai" | "extract" | "wait";
export type ExtractMethod = "selectors" | "code" | "screenshot" | "html" | "llm";

export interface WorkflowStep {
  type: StepType;
  instruction: string;
  command?: string;
  url?: string;
  value?: string;
  task?: string;
  method?: ExtractMethod;
  extraction_selectors?: Record<string, string>;
  extractor_fn?: string;
  extract_instruction?: string;
  extraction_format?: Record<string, unknown>;
  scroll_x?: number;
  scroll_y?: number;
  sleep_before: number;
  duration: number;
  skip_command: boolean;
  max_retries: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  parameters: string[];
  steps: WorkflowStep[];
}

export const STEP_DEFAULTS: Omit<WorkflowStep, "type"> = {
  instruction: "",
  sleep_before: 0,
  duration: 0,
  skip_command: false,
  max_retries: 3,
};

export function makeStep(type: StepType): WorkflowStep {
  return { type, ...STEP_DEFAULTS };
}

export function makeWorkflow(name: string): Omit<Workflow, "id"> {
  return {
    name,
    description: "",
    created_at: new Date().toISOString(),
    parameters: [],
    steps: [],
  };
}

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  navigate: "Navigate",
  click: "Click",
  fill: "Fill",
  select: "Select",
  scroll: "Scroll",
  ai: "AI Agent",
  extract: "Extract",
  wait: "Wait",
};

export type RunStatus = "pending" | "running" | "success" | "healed" | "failed" | "skipped";
