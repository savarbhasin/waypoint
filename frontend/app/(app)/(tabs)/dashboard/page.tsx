"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WorkflowCard } from "@/components/WorkflowCard";
import { NewWorkflowDialog } from "@/components/NewWorkflowDialog";
import { StatusPip } from "@/components/StatusPip";
import type { DashboardSummary } from "@/lib/runs/api";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import type { Workflow } from "@/types/workflow";

interface UserRun {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  params: Record<string, string>;
  workflowId: string;
  workflowName: string;
}

const SUMMARY_POLL_MS = 18_000;
const RECENTLY_ACTIVE_LIMIT = 6;

function selectRecentlyActiveWorkflows(
  workflows: Workflow[],
  workflowStats: DashboardSummary["workflowStats"] | undefined,
): Workflow[] {
  const stats = workflowStats ?? {};

  const withRuns = workflows
    .filter((wf) => stats[wf.id]?.lastRun?.startedAt)
    .sort((a, b) => {
      const aTime = new Date(stats[a.id]!.lastRun!.startedAt).getTime();
      const bTime = new Date(stats[b.id]!.lastRun!.startedAt).getTime();
      return bTime - aTime;
    });

  const selected = withRuns.slice(0, RECENTLY_ACTIVE_LIMIT);
  const selectedIds = new Set(selected.map((wf) => wf.id));

  if (selected.length >= RECENTLY_ACTIVE_LIMIT) return selected;

  const remaining = workflows
    .filter((wf) => !selectedIds.has(wf.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return [...selected, ...remaining.slice(0, RECENTLY_ACTIVE_LIMIT - selected.length)];
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

function formatElapsed(startedAt: string, now: number): string {
  return formatDurationMs(now - new Date(startedAt).getTime());
}

function formatRelative(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActivityTitle(date: string, total: number, failed: number): string {
  const label = formatDayLabel(date);
  if (total === 0) return `${label}: no runs`;
  if (failed === 0) return `${label}: ${total} run${total === 1 ? "" : "s"}`;
  return `${label}: ${total} run${total === 1 ? "" : "s"}, ${failed} failed`;
}

function paramEntries(params: Record<string, string>): [string, string][] {
  return Object.entries(params).filter(([, v]) => v !== "");
}

function truncateError(error: string, max = 120): string {
  if (error.length <= max) return error;
  return `${error.slice(0, max - 1)}…`;
}

function ActivitySparkbar({ activity }: { activity: { date: string; total: number; failed: number }[] }) {
  const maxTotal = Math.max(...activity.map((d) => d.total), 0);
  const maxBarHeight = 48;
  const minBarHeight = 2;
  const midIndex = Math.floor((activity.length - 1) / 2);

  return (
    <div className="flex items-end gap-[3px] h-14">
      {activity.map((day, i) => {
        const height =
          maxTotal === 0
            ? minBarHeight
            : Math.max(minBarHeight, Math.round((day.total / maxTotal) * maxBarHeight));
        const barColor =
          day.total === 0
            ? "bg-hairline-strong"
            : day.failed > 0
              ? "bg-ember"
              : "bg-moss";
        const showLabel = i === 0 || i === midIndex || i === activity.length - 1;

        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className={`w-full rounded-sm ${barColor}`}
              style={{ height }}
              title={formatActivityTitle(day.date, day.total, day.failed)}
            />
            {showLabel && (
              <span className="font-mono text-[0.5625rem] text-fog-dim truncate w-full text-center">
                {formatDayLabel(day.date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusStrip({
  loading,
  stats,
}: {
  loading: boolean;
  stats: DashboardSummary["stats"] | null;
}) {
  const dim = loading || !stats;

  return (
    <div className="flex flex-wrap items-center gap-y-1 font-mono text-[0.6875rem] tabular-nums text-paper border border-hairline rounded-sm px-4 py-2.5 mb-10">
      <span className={dim ? "text-fog-dim" : undefined}>
        Running: {dim ? "—" : stats.runningCount}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        Today: {dim ? "—" : stats.runsToday}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        7d success: {dim ? "—" : stats.successRate7d !== null ? `${stats.successRate7d}%` : "—"}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        Workflows: {dim ? "—" : stats.workflowCount}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const workflows = useWorkflowStore((s) => s.workflows);
  const loading = useWorkflowStore((s) => s.loading);
  const initialized = useWorkflowStore((s) => s.initialized);
  const unauthorized = useWorkflowStore((s) => s.unauthorized);
  const fetchError = useWorkflowStore((s) => s.error);
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows);

  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runningRuns, setRunningRuns] = useState<UserRun[]>([]);
  const [runningLoading, setRunningLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  const prevRunningCount = useRef(0);
  const cancelTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchRunning = useCallback(async () => {
    try {
      const res = await fetch("/api/runs?status=running");
      if (!res.ok) return;
      const data = (await res.json()) as UserRun[];
      setRunningRuns(data);
      setCancellingIds((prev) => {
        const next = new Set(prev);
        for (const id of prev) {
          if (!data.some((r) => r.id === id)) next.delete(id);
        }
        return next;
      });
    } catch {
      // ignore fetch errors
    } finally {
      setRunningLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) return;
      const data = (await res.json()) as DashboardSummary;
      setSummary(data);
    } catch {
      // ignore fetch errors
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const cancelRun = useCallback(
    async (runId: string) => {
      setCancellingIds((prev) => new Set(prev).add(runId));

      const existing = cancelTimeouts.current.get(runId);
      if (existing) clearTimeout(existing);

      try {
        await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
      } catch {
        // best-effort
      }

      const timeout = setTimeout(() => {
        setRunningRuns((prev) => prev.filter((r) => r.id !== runId));
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(runId);
          return next;
        });
        cancelTimeouts.current.delete(runId);
      }, 5000);
      cancelTimeouts.current.set(runId, timeout);
    },
    [],
  );

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (unauthorized) router.replace("/sign-in");
  }, [unauthorized, router]);

  useEffect(() => {
    fetchRunning();
    fetchSummary();
  }, [fetchRunning, fetchSummary]);

  useEffect(() => {
    const count = runningRuns.length;
    const prev = prevRunningCount.current;
    if ((prev > 0 && count < prev) || (prev === 0 && count > 0)) {
      fetchSummary();
    }
    prevRunningCount.current = count;
  }, [runningRuns.length, fetchSummary]);

  useEffect(() => {
    const interval = setInterval(fetchSummary, SUMMARY_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  useEffect(() => {
    if (runningRuns.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningRuns.length]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pollMs = runningRuns.length > 0 ? 2500 : 8000;
    const interval = setInterval(fetchRunning, pollMs);
    return () => clearInterval(interval);
  }, [runningRuns.length, fetchRunning]);

  useEffect(() => {
    const timeouts = cancelTimeouts.current;
    return () => {
      for (const timeout of timeouts.values()) clearTimeout(timeout);
    };
  }, []);

  const attention = summary?.attention ?? [];

  const recentlyActive = useMemo(
    () => selectRecentlyActiveWorkflows(workflows, summary?.workflowStats),
    [workflows, summary?.workflowStats],
  );

  return (
    <div className="min-h-screen max-w-[1080px] mx-auto px-8 pt-8 pb-20">
      {(error || fetchError) && (
        <div className="mb-6 px-4 py-3 bg-ember-dim border border-ember rounded-md text-sm flex justify-between gap-4">
          <span>{error ?? fetchError}</span>
          <button className="text-fog hover:text-paper" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <StatusStrip loading={summaryLoading} stats={summary?.stats ?? null} />

      {/* Running now */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Running now</span>
          {!runningLoading && runningRuns.length > 0 && (
            <span className="font-mono text-[0.625rem] text-fog-dim">{runningRuns.length}</span>
          )}
        </div>

        {runningLoading ? (
          <p className="text-fog-dim text-xs">Loading…</p>
        ) : runningRuns.length === 0 ? (
          <p className="text-fog-dim text-xs">Nothing running right now.</p>
        ) : (
          <ul className="space-y-2">
            {runningRuns.map((run) => {
              const params = paramEntries(run.params);
              const cancelling = cancellingIds.has(run.id);
              return (
                <li key={run.id}>
                  <div
                    className={`flex items-stretch gap-3 p-4 bg-panel border border-hairline rounded-lg transition-all ${cancelling ? "opacity-60" : "hover:border-hairline-strong hover:bg-panel-raised"}`}
                  >
                    <Link
                      href={`/w/${encodeURIComponent(run.workflowId)}`}
                      className="group flex flex-col gap-2.5 flex-1 min-w-0 no-underline text-inherit"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StatusPip status="running" />
                          <span className="font-mono text-[0.9375rem] font-medium tracking-tight text-paper truncate group-hover:text-amber transition-colors">
                            {run.workflowName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wide text-signal">
                            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                            {cancelling ? "cancelling…" : "running"}
                          </span>
                          <span className="font-mono text-[0.6875rem] text-fog tabular-nums">
                            {formatElapsed(run.startedAt, now)}
                          </span>
                        </div>
                      </div>
                      {params.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pl-[21px]">
                          {params.map(([key, value]) => (
                            <span
                              key={key}
                              className="font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5"
                            >
                              {key}={value}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                    <button
                      type="button"
                      className="shrink-0 self-center font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-2.5 py-1 hover:text-paper hover:border-hairline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={cancelling}
                      onClick={() => cancelRun(run.id)}
                    >
                      {cancelling ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Needs attention */}
      {attention.length > 0 && (
        <section className="mb-10 pt-8 border-t border-hairline">
          <div className="flex items-baseline justify-between mb-4">
            <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Needs attention</span>
            <span className="font-mono text-[0.625rem] text-fog-dim">{attention.length}</span>
          </div>
          <ul className="border border-ember bg-ember-dim rounded-md overflow-hidden divide-y divide-ember/30">
            {attention.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-4 mb-1">
                  <Link
                    href={`/w/${encodeURIComponent(item.workflowId)}`}
                    className="font-mono text-[0.8125rem] text-paper hover:text-amber no-underline truncate min-w-0"
                  >
                    {item.workflowName}
                  </Link>
                  <span className="font-mono text-[0.6875rem] text-fog shrink-0 tabular-nums">
                    {formatRelative(item.startedAt, now)}
                  </span>
                </div>
                <p className="text-[0.8125rem] text-ember truncate">
                  {item.error ? truncateError(item.error) : (
                    <span className="text-fog-dim">No error message recorded</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Activity */}
      <section className="mb-10 pt-8 border-t border-hairline">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Activity</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.625rem] text-fog-dim">14 days</span>
            <Link href="/analytics" className="text-xs text-fog hover:text-amber no-underline">
              View full analytics →
            </Link>
          </div>
        </div>
        {summaryLoading || !summary ? (
          <div className="flex items-end gap-[3px] h-14">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-hairline rounded-sm" />
            ))}
          </div>
        ) : (
          <ActivitySparkbar activity={summary.activity} />
        )}
      </section>

      {/* Recently active */}
      <section className="pt-8 border-t border-hairline">
        <div className="flex items-baseline justify-between mb-5">
          <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Recently active</span>
          <div className="flex items-center gap-3">
            <Link href="/workflows" className="text-xs text-fog hover:text-amber no-underline">
              View all workflows →
            </Link>
            <button
              className="text-sm font-medium px-4 py-2 bg-amber border border-amber text-[#1a1206] rounded-md inline-flex items-center gap-1.5 hover:bg-[#f0ac4c]"
              onClick={() => setShowNew(true)}
            >
              <Plus size={14} />
              New workflow
            </button>
          </div>
        </div>

        {!initialized || loading ? (
          <p className="text-fog text-sm">Loading…</p>
        ) : workflows.length === 0 ? (
          <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
            No workflows yet. Record one with the CLI, or create one here.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {recentlyActive.map((wf) => {
              const stats = summary?.workflowStats[wf.id] ?? {
                lastRun: null,
                totalRuns: 0,
                successRate: null,
              };
              return (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  stats={summaryLoading ? undefined : stats}
                  now={now}
                />
              );
            })}
          </div>
        )}
      </section>

      {showNew && <NewWorkflowDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
