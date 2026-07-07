"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { WorkflowCardGridSkeleton } from "@/components/Skeleton";
import { WorkflowCard } from "@/components/WorkflowCard";
import type { WorkflowCardStats } from "@/components/WorkflowCard";
import { NewWorkflowDialog } from "@/components/NewWorkflowDialog";
import { ImportButton } from "@/components/ImportButton";
import type { DashboardSummary } from "@/lib/runs/api";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import type { Workflow } from "@/types/workflow";

type SortOption = "recently-run" | "recently-updated" | "name" | "most-runs" | "success-rate";

const SORT_LABELS: Record<SortOption, string> = {
  "recently-run": "Recently run",
  "recently-updated": "Recently updated",
  name: "Name (A–Z)",
  "most-runs": "Most runs",
  "success-rate": "Success rate",
};

const EMPTY_STATS: WorkflowCardStats = { lastRun: null, totalRuns: 0, successRate: null };

function getDefaultSort(workflowStats: DashboardSummary["workflowStats"]): SortOption {
  const hasRunHistory = Object.values(workflowStats).some((s) => s.lastRun !== null);
  return hasRunHistory ? "recently-run" : "recently-updated";
}

function compareNullableDesc<T>(a: T | null | undefined, b: T | null | undefined, compare: (x: T, y: T) => number): number {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return compare(a, b);
}

function sortWorkflows(
  items: Workflow[],
  sort: SortOption,
  workflowStats: DashboardSummary["workflowStats"],
): Workflow[] {
  const sorted = [...items];

  switch (sort) {
    case "recently-updated":
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      break;
    case "most-runs":
      sorted.sort((a, b) => {
        const aRuns = workflowStats[a.id]?.totalRuns ?? 0;
        const bRuns = workflowStats[b.id]?.totalRuns ?? 0;
        return bRuns - aRuns;
      });
      break;
    case "success-rate":
      sorted.sort((a, b) => {
        const aRate = workflowStats[a.id]?.successRate ?? null;
        const bRate = workflowStats[b.id]?.successRate ?? null;
        return compareNullableDesc(aRate, bRate, (x, y) => y - x);
      });
      break;
    case "recently-run":
      sorted.sort((a, b) => {
        const aStarted = workflowStats[a.id]?.lastRun?.startedAt ?? null;
        const bStarted = workflowStats[b.id]?.lastRun?.startedAt ?? null;
        return compareNullableDesc(aStarted, bStarted, (x, y) => new Date(y).getTime() - new Date(x).getTime());
      });
      break;
  }

  return sorted;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const workflows = useWorkflowStore((s) => s.workflows);
  const loading = useWorkflowStore((s) => s.loading);
  const initialized = useWorkflowStore((s) => s.initialized);
  const unauthorized = useWorkflowStore((s) => s.unauthorized);
  const fetchError = useWorkflowStore((s) => s.error);
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows);

  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (unauthorized) router.replace("/sign-in");
  }, [unauthorized, router]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const workflowStats = useMemo(
    () => summary?.workflowStats ?? {},
    [summary],
  );
  const effectiveSort = sortOption ?? (summary ? getDefaultSort(workflowStats) : "recently-updated");

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? workflows.filter(
          (wf) =>
            wf.name.toLowerCase().includes(query) ||
            wf.description.toLowerCase().includes(query),
        )
      : workflows;
    return sortWorkflows(filtered, effectiveSort, workflowStats);
  }, [workflows, search, effectiveSort, workflowStats]);

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

      <div className="flex items-baseline justify-between mb-5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Workflows</span>
        <div className="flex items-center gap-3">
          {initialized && !loading && (
            <span className="font-mono text-[0.6875rem] text-fog-dim">{workflows.length} total</span>
          )}
          <div className="flex gap-2">
            <ImportButton onError={setError} />
            <button
              className="text-sm font-medium px-4 py-2 bg-amber border border-amber text-[#1a1206] rounded-md inline-flex items-center gap-1.5 hover:bg-[#f0ac4c]"
              onClick={() => setShowNew(true)}
            >
              <Plus size={14} />
              New workflow
            </button>
          </div>
        </div>
      </div>

      {initialized && !loading && workflows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or description…"
              className="bg-ink-raised border border-hairline-strong rounded-md pl-9 pr-3 py-2 text-sm text-paper w-full focus:border-signal"
            />
          </div>
          <select
            value={effectiveSort}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            aria-label="Sort workflows"
            className="bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm text-paper w-full sm:w-auto focus:border-signal font-mono text-[0.8125rem]"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      )}

      {!initialized || loading ? (
        <WorkflowCardGridSkeleton count={6} />
      ) : workflows.length === 0 ? (
        <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
          No workflows yet. Record one with the CLI, or create one here.
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
          <p>No workflows match &ldquo;{search.trim()}&rdquo;.</p>
          <button
            type="button"
            className="mt-3 font-mono text-[0.8125rem] text-signal hover:text-paper transition-colors"
            onClick={() => setSearch("")}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filteredSorted.map((wf) => {
            const stats = workflowStats[wf.id] ?? EMPTY_STATS;
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

      {showNew && <NewWorkflowDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
