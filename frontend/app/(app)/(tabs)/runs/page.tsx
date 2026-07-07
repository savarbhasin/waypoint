"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { RunListSkeleton } from "@/components/Skeleton";
import type { RunEvent } from "@/lib/runs/types";
import { formatRunEventLine, type RunLine } from "@/hooks/useWorkflowRun";
import { listWorkflows } from "@/lib/workflows/client";
import type { Workflow } from "@/types/workflow";

interface UserRun {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  params: Record<string, string>;
  workflowId: string;
  workflowName: string;
  error: string | null;
}

type StatusFilter = "all" | "running" | "completed" | "failed";

const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

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

function formatDurationMs(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}

function runDuration(run: UserRun): string | null {
  if (!run.endedAt) return null;
  return formatDurationMs(new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime());
}

function paramEntries(params: Record<string, string>): [string, string][] {
  return Object.entries(params).filter(([, v]) => v !== "");
}

function truncateError(error: string, max = 120): string {
  if (error.length <= max) return error;
  return `${error.slice(0, max - 1)}…`;
}

function eventsToLines(events: RunEvent[]): RunLine[] {
  return events.filter((e) => e.type !== "frame").map(formatRunEventLine);
}

function buildRunsUrl(status: StatusFilter, workflowId: string, before?: string): string {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  if (status !== "all") params.set("status", status);
  if (workflowId) params.set("workflowId", workflowId);
  if (before) params.set("before", before);
  return `/api/runs?${params}`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<UserRun[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [workflowFilter, setWorkflowFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<RunLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const hasActiveFilters = statusFilter !== "all" || workflowFilter !== "";

  const fetchRuns = useCallback(
    async (append: boolean, before?: string) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setExpandedId(null);
        setDetailLines([]);
      }

      try {
        const res = await fetch(buildRunsUrl(statusFilter, workflowFilter, before));
        if (!res.ok) return;
        const data = (await res.json()) as UserRun[];

        setRuns((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length >= PAGE_SIZE);
      } catch {
        if (!append) setRuns([]);
        setHasMore(false);
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [statusFilter, workflowFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setWorkflowsLoading(true);
    listWorkflows()
      .then((data) => {
        if (!cancelled) setWorkflows(data);
      })
      .catch(() => {
        if (!cancelled) setWorkflows([]);
      })
      .finally(() => {
        if (!cancelled) setWorkflowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchRuns(false);
  }, [fetchRuns]);

  function clearFilters() {
    setStatusFilter("all");
    setWorkflowFilter("");
  }

  function loadMore() {
    if (loadingMore || !hasMore || runs.length === 0) return;
    const oldest = runs[runs.length - 1];
    fetchRuns(true, oldest.startedAt);
  }

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
    <div className="min-h-screen max-w-[1080px] mx-auto px-8 pt-8 pb-20">
      <div className="mb-8">
        <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog mb-1">Audit trail</p>
        <h1 className="font-display text-[2rem] text-paper leading-tight">Runs</h1>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map(({ value, label }) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`font-mono text-[0.6875rem] uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                  active
                    ? "bg-panel-raised border-hairline-strong text-paper"
                    : "bg-transparent border-hairline text-fog hover:border-hairline-strong hover:text-paper"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog shrink-0" htmlFor="workflow-filter">
            Workflow
          </label>
          <select
            id="workflow-filter"
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            disabled={workflowsLoading}
            className="bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm text-paper w-full sm:max-w-xs focus:border-signal font-mono text-[0.8125rem]"
          >
            <option value="">All workflows</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <RunListSkeleton count={6} />
      ) : runs.length === 0 ? (
        <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
          {hasActiveFilters ? (
            <>
              <p>No runs match the current filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 font-mono text-[0.6875rem] uppercase tracking-wide text-amber hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <p>No runs yet. Trigger a run from any workflow to see it here.</p>
          )}
        </div>
      ) : (
        <>
          <div className="border border-hairline rounded-md overflow-hidden divide-y divide-hairline">
            {runs.map((run) => {
              const expanded = expandedId === run.id;
              const duration = runDuration(run);
              const params = paramEntries(run.params);

              return (
                <div key={run.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 text-left hover:bg-hairline/40 transition-colors cursor-pointer"
                    onClick={() => toggleRun(run.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleRun(run.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {expanded ? (
                        <ChevronDown size={13} className="text-fog shrink-0" />
                      ) : (
                        <ChevronRight size={13} className="text-fog shrink-0" />
                      )}
                      <span
                        className={`font-mono text-[0.6875rem] uppercase tracking-wide shrink-0 ${STATUS_COLORS[run.status] ?? "text-fog"}`}
                      >
                        {run.status}
                      </span>
                      <Link
                        href={`/w/${run.workflowId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs text-paper hover:text-amber truncate"
                      >
                        {run.workflowName}
                      </Link>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5 sm:pl-0 shrink-0">
                      <span className="font-mono text-[0.6875rem] text-fog">{formatTimestamp(run.startedAt)}</span>
                      {duration && (
                        <span className="font-mono text-[0.6875rem] text-fog-dim">{duration}</span>
                      )}
                      {params.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {params.slice(0, 3).map(([key, value]) => (
                            <span
                              key={key}
                              className="font-mono text-[0.625rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5 max-w-[140px] truncate"
                              title={`${key}=${value}`}
                            >
                              {key}={value}
                            </span>
                          ))}
                          {params.length > 3 && (
                            <span className="font-mono text-[0.625rem] text-fog-dim">+{params.length - 3}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {run.status === "failed" && run.error && !expanded && (
                    <div className="px-4 pb-2 pl-9">
                      <p className="font-mono text-[0.6875rem] text-ember truncate" title={run.error}>
                        {truncateError(run.error)}
                      </p>
                    </div>
                  )}

                  {expanded && (
                    <div className="border-t border-hairline px-4 py-3 font-mono text-xs leading-relaxed max-h-[240px] overflow-y-auto bg-ink">
                      {run.status === "failed" && run.error && (
                        <p className="text-ember mb-2 whitespace-pre-wrap break-words">{run.error}</p>
                      )}
                      {detailLoading ? (
                        <p className="text-fog-dim text-xs">Loading log…</p>
                      ) : detailLines.length === 0 ? (
                        <p className="text-fog-dim text-xs">No events recorded.</p>
                      ) : (
                        detailLines.map((line, i) => (
                          <div
                            key={i}
                            className={`whitespace-pre-wrap break-words ${TONE_COLORS[line.tone] ?? "text-fog"}`}
                          >
                            {line.text}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="font-mono text-[0.6875rem] uppercase tracking-wide px-4 py-2 border border-hairline-strong rounded-md text-fog hover:text-paper hover:border-fog disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
