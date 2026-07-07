import Link from "next/link";
import { StatusPip } from "@/components/StatusPip";
import type { RunStatus, Workflow } from "@/types/workflow";

export interface WorkflowCardStats {
  lastRun: { status: string; startedAt: string } | null;
  totalRuns: number;
  successRate: number | null;
}

function runStatusToPip(status: string): RunStatus {
  if (status === "completed") return "success";
  if (status === "failed") return "failed";
  if (status === "running") return "running";
  return "pending";
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function WorkflowCard({
  workflow,
  stats,
  now = Date.now(),
}: {
  workflow: Workflow;
  stats?: WorkflowCardStats;
  now?: number;
}) {
  return (
    <Link
      href={`/w/${encodeURIComponent(workflow.id)}`}
      className="group flex flex-col gap-3.5 p-5 bg-panel border border-hairline rounded-lg text-inherit no-underline relative transition-all hover:border-hairline-strong hover:bg-panel-raised hover:-translate-y-0.5"
    >
      <div className="absolute top-6 -left-px w-0.5 h-5 bg-amber opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-[0.9375rem] font-medium tracking-tight text-paper">{workflow.name}</span>
        <span className="font-mono text-[0.6875rem] text-fog-dim whitespace-nowrap pt-0.5">{formatDate(workflow.created_at)}</span>
      </div>
      <p className="text-[0.8125rem] text-fog leading-relaxed min-h-[2.4em]">{workflow.description || "No description yet."}</p>
      {stats && (
        <div className="flex items-center gap-3 font-mono text-[0.6875rem] text-fog tabular-nums">
          {stats.lastRun ? (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <StatusPip status={runStatusToPip(stats.lastRun.status)} />
              <span className="truncate">{formatRelative(stats.lastRun.startedAt, now)}</span>
            </span>
          ) : (
            <span className="text-fog-dim">No runs yet</span>
          )}
          <span className="text-hairline-strong">·</span>
          <span>{stats.totalRuns} run{stats.totalRuns === 1 ? "" : "s"}</span>
          <span className="text-hairline-strong">·</span>
          <span>{stats.successRate !== null ? `${stats.successRate}%` : "—"}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-1 pt-3.5 border-t border-hairline">
        <div className="flex gap-[3px] items-center">
          {workflow.steps.slice(0, 24).map((s, i) => (
            <span
              key={i}
              className={`w-[5px] h-[5px] rounded-[1px] ${s.type === "ai" ? "bg-amber" : s.type === "extract" ? "bg-signal" : "bg-fog-dim"}`}
            />
          ))}
          <span className="font-mono text-[0.6875rem] text-fog ml-1.5">{workflow.steps.length} steps</span>
        </div>
        {workflow.parameters.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {workflow.parameters.slice(0, 3).map((p) => (
              <span key={p} className="font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5">
                {p}
              </span>
            ))}
            {workflow.parameters.length > 3 && (
              <span className="font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5">
                +{workflow.parameters.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
