"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AnalyticsSummary, DailyActivity } from "@/lib/analytics/api";

type RangeDays = 30 | 90;

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

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

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActivityTitle(day: DailyActivity): string {
  const label = formatDayLabel(day.date);
  if (day.total === 0) return `${label}: no runs`;
  if (day.failed === 0) return `${label}: ${day.total} run${day.total === 1 ? "" : "s"}`;
  return `${label}: ${day.total} run${day.total === 1 ? "" : "s"}, ${day.failed} failed`;
}

function formatRate(value: number | null): string {
  return value !== null ? `${value}%` : "—";
}

function formatAvgDuration(value: number | null): string {
  return value !== null ? formatDurationMs(value) : "—";
}

function RangeToggle({
  value,
  onChange,
  disabled,
}: {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center border border-hairline rounded-md p-0.5">
      {RANGE_OPTIONS.map(({ value: optionValue, label }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            disabled={disabled}
            onClick={() => onChange(optionValue)}
            className={`font-mono text-[0.6875rem] uppercase tracking-wide px-3 py-1.5 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "bg-panel-raised text-paper"
                : "text-fog hover:text-paper"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatsStrip({
  loading,
  summary,
}: {
  loading: boolean;
  summary: AnalyticsSummary | null;
}) {
  const dim = loading || !summary;

  return (
    <div className="flex flex-wrap items-center gap-y-1 font-mono text-[0.6875rem] tabular-nums text-paper border border-hairline rounded-sm px-4 py-2.5">
      <span className={dim ? "text-fog-dim" : undefined}>
        Total runs: {dim ? "—" : summary.totalRuns}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        Success rate: {dim ? "—" : formatRate(summary.overallSuccessRate)}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        Avg duration: {dim ? "—" : formatAvgDuration(summary.avgDurationMs)}
      </span>
      <span className="mx-3 text-hairline-strong select-none">·</span>
      <span className={dim ? "text-fog-dim" : undefined}>
        Heal rate: {dim ? "—" : formatRate(summary.healRate)}
      </span>
    </div>
  );
}

function DailyTrendChart({ activity }: { activity: DailyActivity[] }) {
  const maxTotal = Math.max(...activity.map((d) => d.total), 0);
  const maxBarHeight = 56;
  const minBarHeight = 2;
  const isWide = activity.length > 45;
  const gapClass = isWide ? "gap-px" : "gap-[3px]";
  const midIndex = Math.floor((activity.length - 1) / 2);

  return (
    <div className={`flex items-end ${gapClass} h-16`}>
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
              title={formatActivityTitle(day)}
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

function ReliabilityPanel({
  title,
  entries,
  variant,
}: {
  title: string;
  entries: AnalyticsSummary["mostReliable"];
  variant: "moss" | "ember";
}) {
  const borderClass = variant === "moss" ? "border-moss/40 bg-moss-dim" : "border-ember/40 bg-ember-dim";
  const rateClass = variant === "moss" ? "text-moss" : "text-ember";

  return (
    <div className={`border rounded-md overflow-hidden ${borderClass}`}>
      <div className="px-4 py-2.5 border-b border-hairline">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">{title}</span>
      </div>
      <ul className="divide-y divide-hairline">
        {entries.map((entry) => (
          <li key={entry.workflowId} className="px-4 py-3 flex items-baseline justify-between gap-4">
            <Link
              href={`/w/${encodeURIComponent(entry.workflowId)}`}
              className="font-mono text-[0.8125rem] text-paper hover:text-amber no-underline truncate min-w-0"
            >
              {entry.workflowName}
            </Link>
            <span className={`font-mono text-[0.6875rem] tabular-nums shrink-0 ${rateClass}`}>
              {entry.successRate}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async (days: RangeDays) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/summary?days=${days}`);
      if (!res.ok) return;
      const data = (await res.json()) as AnalyticsSummary;
      setSummary(data);
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(rangeDays);
  }, [rangeDays, fetchSummary]);

  function handleRangeChange(days: RangeDays) {
    if (days !== rangeDays) setRangeDays(days);
  }

  const isEmpty = !loading && summary !== null && summary.totalRuns === 0;

  return (
    <div className="min-h-screen max-w-[1080px] mx-auto px-8 pt-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog mb-1">Trends</p>
          <h1 className="font-display text-[2rem] text-paper leading-tight">Analytics</h1>
        </div>
        <RangeToggle value={rangeDays} onChange={handleRangeChange} disabled={loading} />
      </div>

      <div className="mb-10">
        <StatsStrip loading={loading} summary={summary} />
      </div>

      {loading ? (
        <p className="text-fog-dim text-xs font-mono">Loading…</p>
      ) : isEmpty ? (
        <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
          No runs in the last {rangeDays} days yet.
        </div>
      ) : summary ? (
        <>
          <section className="mb-10 pt-8 border-t border-hairline">
            <div className="flex items-baseline justify-between mb-4">
              <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">
                Daily activity
              </span>
              <span className="font-mono text-[0.625rem] text-fog-dim">{rangeDays} days</span>
            </div>
            <DailyTrendChart activity={summary.dailyActivity} />
          </section>

          {(summary.mostReliable.length > 0 || summary.leastReliable.length > 0) && (
            <section className="mb-10 pt-8 border-t border-hairline">
              <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog block mb-4">
                Reliability
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.mostReliable.length > 0 && (
                  <ReliabilityPanel
                    title="Most reliable"
                    entries={summary.mostReliable}
                    variant="moss"
                  />
                )}
                {summary.leastReliable.length > 0 && (
                  <ReliabilityPanel
                    title="Needs improvement"
                    entries={summary.leastReliable}
                    variant="ember"
                  />
                )}
              </div>
            </section>
          )}

          <section className="pt-8 border-t border-hairline">
            <div className="flex items-baseline justify-between mb-4">
              <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">
                Workflow leaderboard
              </span>
              <span className="font-mono text-[0.625rem] text-fog-dim">
                {summary.workflowLeaderboard.length} workflow
                {summary.workflowLeaderboard.length === 1 ? "" : "s"}
              </span>
            </div>

            {summary.workflowLeaderboard.length === 0 ? (
              <p className="text-fog-dim text-xs">No workflow data in this range.</p>
            ) : (
              <div className="border border-hairline rounded-md overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-panel">
                      <th className="font-mono text-[0.625rem] uppercase tracking-widest text-fog font-normal px-4 py-2.5">
                        Workflow
                      </th>
                      <th className="font-mono text-[0.625rem] uppercase tracking-widest text-fog font-normal px-4 py-2.5 text-right w-24">
                        Runs
                      </th>
                      <th className="font-mono text-[0.625rem] uppercase tracking-widest text-fog font-normal px-4 py-2.5 text-right w-28">
                        Success
                      </th>
                      <th className="font-mono text-[0.625rem] uppercase tracking-widest text-fog font-normal px-4 py-2.5 text-right w-32">
                        Avg duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {summary.workflowLeaderboard.map((entry) => (
                      <tr key={entry.workflowId} className="hover:bg-panel/50 transition-colors">
                        <td className="px-4 py-3 min-w-0">
                          <Link
                            href={`/w/${encodeURIComponent(entry.workflowId)}`}
                            className="font-mono text-[0.8125rem] text-paper hover:text-amber no-underline truncate block"
                          >
                            {entry.workflowName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.6875rem] tabular-nums text-paper text-right">
                          {entry.totalRuns}
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.6875rem] tabular-nums text-right">
                          {entry.successRate !== null ? (
                            <span className={entry.successRate >= 80 ? "text-moss" : entry.successRate < 50 ? "text-ember" : "text-paper"}>
                              {entry.successRate}%
                            </span>
                          ) : (
                            <span className="text-fog-dim">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.6875rem] tabular-nums text-fog text-right">
                          {formatAvgDuration(entry.avgDurationMs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
