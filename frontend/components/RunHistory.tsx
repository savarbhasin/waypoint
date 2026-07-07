"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { RunEvent } from "@/lib/runs/types";
import { formatRunEventLine, type RunLine } from "@/hooks/useWorkflowRun";

interface RunSummary {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  params: Record<string, string>;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-moss",
  failed: "text-ember",
  running: "text-signal",
};

const TONE_COLORS: Record<string, string> = {
  success: "text-moss",
  healed: "text-amber",
  failed: "text-ember",
  running: "text-signal",
  pending: "text-fog",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventsToLines(events: RunEvent[]): RunLine[] {
  return events.filter((e) => e.type !== "frame").map(formatRunEventLine);
}

export function RunHistory({ workflowId, running }: { workflowId: string; running: boolean }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<RunLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const prevRunning = useRef(running);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      if (!res.ok) return;
      const data = (await res.json()) as RunSummary[];
      setRuns(data);
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    setLoading(true);
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (prevRunning.current && !running) {
      fetchRuns();
    }
    prevRunning.current = running;
  }, [running, fetchRuns]);

  async function toggleRun(runId: string) {
    if (expandedId === runId) {
      setExpandedId(null);
      setDetailLines([]);
      return;
    }

    setExpandedId(runId);
    setDetailLoading(true);
    setDetailLines([]);

    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { history: RunEvent[] };
      setDetailLines(eventsToLines(data.history));
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="border-t border-hairline shrink-0">
      <div className="flex items-baseline justify-between px-5 py-2.5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Run history</span>
        {!loading && runs.length > 0 && (
          <span className="font-mono text-[0.625rem] text-fog-dim">{runs.length}</span>
        )}
      </div>

      <div className="px-5 pb-5 max-h-[240px] overflow-y-auto">
        {loading ? (
          <p className="text-fog-dim text-xs">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-fog-dim text-xs">No past runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.map((run) => {
              const expanded = expandedId === run.id;
              return (
                <li key={run.id} className="border border-hairline rounded-md overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hairline/40"
                    onClick={() => toggleRun(run.id)}
                  >
                    {expanded ? (
                      <ChevronDown size={13} className="text-fog shrink-0" />
                    ) : (
                      <ChevronRight size={13} className="text-fog shrink-0" />
                    )}
                    <span className={`font-mono text-[0.6875rem] uppercase tracking-wide shrink-0 ${STATUS_COLORS[run.status] ?? "text-fog"}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-fog truncate flex-1">{formatTimestamp(run.startedAt)}</span>
                  </button>

                  {expanded && (
                    <div className="border-t border-hairline px-3 py-2 font-mono text-xs leading-relaxed max-h-[160px] overflow-y-auto bg-ink">
                      {detailLoading ? (
                        <p className="text-fog-dim text-xs">Loading log…</p>
                      ) : detailLines.length === 0 ? (
                        <p className="text-fog-dim text-xs">No events recorded.</p>
                      ) : (
                        detailLines.map((line, i) => (
                          <div key={i} className={`whitespace-pre-wrap break-words ${TONE_COLORS[line.tone] ?? "text-fog"}`}>
                            {line.text}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
