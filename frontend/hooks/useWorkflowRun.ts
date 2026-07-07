import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { RunEvent } from "@/lib/runs/types";
import type { RunStatus, Workflow } from "@/types/workflow";
import { missingParams } from "@/lib/params";

export interface RunLine {
  text: string;
  tone: RunStatus;
}

const STEP_STATUS_EVENTS: Partial<Record<RunEvent["type"], RunStatus>> = {
  step_started: "running",
  step_succeeded: "success",
  step_healed: "healed",
  step_failed: "failed",
};

const LINE_TONES: Record<RunEvent["type"], RunStatus> = {
  run_started: "pending",
  step_started: "running",
  step_succeeded: "success",
  step_healed: "healed",
  step_failed: "failed",
  extract_result: "success",
  frame: "pending",
  run_completed: "success",
  run_failed: "failed",
};

function describeEvent(event: RunEvent): string {
  if (event.message) return event.message;
  switch (event.type) {
    case "step_started":
      return typeof event.data?.instruction === "string" ? event.data.instruction : "";
    case "step_healed":
      return typeof event.data?.command === "string" ? `healed -> ${event.data.command}` : "";
    case "step_failed":
      return typeof event.data?.error === "string" ? event.data.error : "";
    case "extract_result":
      return event.data?.result !== undefined ? JSON.stringify(event.data.result) : "";
    case "run_completed": {
      const extracts = Array.isArray(event.data?.extracts) ? event.data.extracts : [];
      return `${extracts.length} extract result(s)`;
    }
    case "run_failed":
      return typeof event.data?.error === "string" ? event.data.error : "";
    default:
      return "";
  }
}

export function formatRunEventLine(event: RunEvent): RunLine {
  const stepLabel = event.step_index !== null ? ` #${event.step_index + 1}` : "";
  const detail = describeEvent(event);
  return {
    text: `> [${event.type}]${stepLabel}${detail ? ` ${detail}` : ""}`,
    tone: LINE_TONES[event.type],
  };
}

async function startRun(workflowId: string, params: Record<string, string>): Promise<{ run_id: string }> {
  const res = await fetch(`/api/workflows/${workflowId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : res.statusText;
    throw new Error(detail || `Failed to start run (${res.status})`);
  }
  return res.json() as Promise<{ run_id: string }>;
}

function streamRun(runId: string, onEvent: (event: RunEvent) => void): () => void {
  const source = new EventSource(`/api/runs/${runId}/stream`);

  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as RunEvent;
      onEvent(event);
    } catch {
      // ignore malformed messages
    }
  };

  return () => source.close();
}

async function cancelRun(runId: string): Promise<void> {
  try {
    await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
  } catch {
    // best-effort
  }
}

function applyRunEvent(
  event: RunEvent,
  setStatuses: Dispatch<SetStateAction<RunStatus[]>>,
  setLines: Dispatch<SetStateAction<RunLine[]>>,
  setLatestFrame: Dispatch<SetStateAction<string | null>>,
  setRunning: Dispatch<SetStateAction<boolean>>,
) {
  if (event.type === "frame") {
    const image = event.data?.image;
    if (typeof image === "string") setLatestFrame(image);
    return;
  }

  if (event.step_index !== null) {
    const status = STEP_STATUS_EVENTS[event.type];
    if (status) {
      const index = event.step_index;
      setStatuses((prev) => {
        const next = [...prev];
        next[index] = status;
        return next;
      });
    }
  }

  setLines((prev) => [...prev, formatRunEventLine(event)]);

  if (event.type === "run_completed" || event.type === "run_failed") {
    setRunning(false);
  }
}

type WorkflowRunInput = Pick<Workflow, "steps" | "parameters">;

export function useWorkflowRun(workflowId: string, workflow: WorkflowRunInput) {
  const [statuses, setStatuses] = useState<RunStatus[]>(() => workflow.steps.map(() => "pending"));
  const [lines, setLines] = useState<RunLine[]>([]);
  const [running, setRunning] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [latestFrame, setLatestFrame] = useState<string | null>(null);

  const runToken = useRef(0);
  const runIdRef = useRef<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    setStatuses(workflow.steps.map(() => "pending"));
    setLines([]);
    setMissing([]);
    setLatestFrame(null);
  }, [workflow.steps]);

  const start = useCallback(
    async (params: Record<string, string>) => {
      const missed = missingParams(workflow.parameters, params);
      if (missed.length > 0) {
        setMissing(missed);
        return;
      }
      setMissing([]);
      const token = ++runToken.current;
      setRunning(true);
      setStatuses(workflow.steps.map(() => "pending"));
      setLatestFrame(null);
      setLines([{ text: `> starting run…`, tone: "pending" }]);

      try {
        const { run_id } = await startRun(workflowId, params);
        if (runToken.current !== token) return;
        runIdRef.current = run_id;

        const stopStream = streamRun(run_id, (event: RunEvent) => {
          if (runToken.current !== token) return;
          applyRunEvent(event, setStatuses, setLines, setLatestFrame, setRunning);
        });

        stopStreamRef.current = stopStream;
      } catch (err) {
        if (runToken.current !== token) return;
        const message = err instanceof Error ? err.message : String(err);
        setLines((prev) => [...prev, { text: `> failed to start run: ${message}`, tone: "failed" }]);
        setRunning(false);
      }
    },
    [workflowId, workflow],
  );

  const stop = useCallback(() => {
    runToken.current++;
    if (runIdRef.current) {
      cancelRun(runIdRef.current);
      runIdRef.current = null;
    }
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    setRunning(false);
    setLines((prev) => [...prev, { text: `> stopped.`, tone: "failed" }]);
  }, []);

  return { statuses, lines, running, missing, latestFrame, start, stop, reset };
}
