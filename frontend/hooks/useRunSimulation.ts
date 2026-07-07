import { useCallback, useRef, useState } from "react";
import type { RunStatus, Workflow } from "@/types/workflow";
import { simulateRun } from "@/lib/simulate";
import { missingParams } from "@/lib/params";

export interface RunLine {
  text: string;
  tone: RunStatus;
}

export function useRunSimulation(workflow: Workflow) {
  const [statuses, setStatuses] = useState<RunStatus[]>(() => workflow.steps.map(() => "pending"));
  const [lines, setLines] = useState<RunLine[]>([]);
  const [running, setRunning] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const runToken = useRef(0);

  const reset = useCallback(() => {
    setStatuses(workflow.steps.map(() => "pending"));
    setLines([]);
    setMissing([]);
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
      setLines([{ text: `> launching chrome on cdp :9222 — dry run, no browser attached`, tone: "pending" }]);

      for await (const event of simulateRun(workflow, params)) {
        if (runToken.current !== token) return;
        setStatuses((prev) => {
          const next = [...prev];
          next[event.index] = event.status;
          return next;
        });
        if (event.log) setLines((prev) => [...prev, { text: event.log!, tone: event.status }]);
      }
      if (runToken.current !== token) return;
      setLines((prev) => [...prev, { text: `> workflow complete.`, tone: "success" }]);
      setRunning(false);
    },
    [workflow]
  );

  const stop = useCallback(() => {
    runToken.current++;
    setRunning(false);
    setLines((prev) => [...prev, { text: `> stopped.`, tone: "failed" }]);
  }, []);

  return { statuses, lines, running, missing, start, stop, reset };
}
