export type RunEventType =
  | "run_started"
  | "step_started"
  | "step_succeeded"
  | "step_healed"
  | "step_failed"
  | "extract_result"
  | "frame"
  | "run_completed"
  | "run_failed";

export interface RunEvent {
  type: RunEventType;
  run_id: string;
  step_index: number | null;
  step_type: string | null;
  message: string | null;
  data: Record<string, unknown> | null;
  timestamp: string;
}

export const TERMINAL_EVENT_TYPES: RunEventType[] = ["run_completed", "run_failed"];

export function isTerminalEvent(event: RunEvent): boolean {
  return TERMINAL_EVENT_TYPES.includes(event.type);
}
