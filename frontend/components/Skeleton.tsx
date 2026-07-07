import type { CSSProperties } from "react";

const shimmerClass =
  "bg-[linear-gradient(90deg,var(--color-panel)_0%,var(--color-panel-raised)_40%,var(--color-hairline-strong)_50%,var(--color-panel-raised)_60%,var(--color-panel)_100%)] bg-[length:200%_100%] animate-[shimmer_2.5s_ease-in-out_infinite]";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`rounded-sm bg-panel ${shimmerClass} ${className}`.trim()} style={style} />;
}

export function WorkflowCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 p-5 bg-panel border border-hairline rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-[0.9375rem] w-3/5" />
        <Skeleton className="h-[0.6875rem] w-16 shrink-0" />
      </div>
      <div className="space-y-2 min-h-[2.4em]">
        <Skeleton className="h-[0.8125rem] w-full" />
        <Skeleton className="h-[0.8125rem] w-4/5" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-[0.6875rem] w-20" />
        <Skeleton className="h-[0.6875rem] w-14" />
        <Skeleton className="h-[0.6875rem] w-10" />
      </div>
      <div className="flex items-center justify-between mt-1 pt-3.5 border-t border-hairline">
        <div className="flex gap-[3px] items-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="w-[5px] h-[5px] rounded-[1px]" />
          ))}
          <Skeleton className="h-[0.6875rem] w-14 ml-1.5" />
        </div>
        <Skeleton className="h-[1.375rem] w-16" />
      </div>
    </div>
  );
}

export function WorkflowCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <WorkflowCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RunningRunSkeleton() {
  return (
    <div className="flex items-stretch gap-3 p-4 bg-panel border border-hairline rounded-lg">
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Skeleton className="w-2 h-2 rounded-full shrink-0" />
            <Skeleton className="h-[0.9375rem] w-2/5" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Skeleton className="h-[0.625rem] w-14" />
            <Skeleton className="h-[0.6875rem] w-10" />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap pl-[21px]">
          <Skeleton className="h-[1.375rem] w-20" />
          <Skeleton className="h-[1.375rem] w-24" />
        </div>
      </div>
      <Skeleton className="h-[1.625rem] w-14 shrink-0 self-center" />
    </div>
  );
}

export function StatusStripSkeleton({ segments = 4 }: { segments?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-y-1 border border-hairline rounded-sm px-4 py-2.5 mb-10">
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="mx-3 text-hairline-strong select-none">·</span>}
          <Skeleton className="h-[0.6875rem] w-24" />
        </span>
      ))}
    </div>
  );
}

export function ActivitySparkbarSkeleton({ bars = 14, heightClass = "h-14" }: { bars?: number; heightClass?: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${heightClass}`}>
      {Array.from({ length: bars }).map((_, i) => {
        const barHeight = 8 + ((i * 7) % 5) * 8;
        const showLabel = i === 0 || i === Math.floor((bars - 1) / 2) || i === bars - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <Skeleton className="w-full rounded-sm" style={{ height: barHeight }} />
            {showLabel && <Skeleton className="h-[0.5625rem] w-full max-w-[2.5rem]" />}
          </div>
        );
      })}
    </div>
  );
}

export function RunListRowSkeleton() {
  return (
    <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Skeleton className="w-[13px] h-[13px] shrink-0" />
        <Skeleton className="h-[0.6875rem] w-16 shrink-0" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5 sm:pl-0 shrink-0">
        <Skeleton className="h-[0.6875rem] w-28" />
        <Skeleton className="h-[0.6875rem] w-12" />
      </div>
    </div>
  );
}

export function RunListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden divide-y divide-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <RunListRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function AnalyticsStatsStripSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-y-1 border border-hairline rounded-sm px-4 py-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="mx-3 text-hairline-strong select-none">·</span>}
          <Skeleton className="h-[0.6875rem] w-28" />
        </span>
      ))}
    </div>
  );
}

export function ReliabilityPanelSkeleton({ titleWidth = "w-28" }: { titleWidth?: string }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden bg-panel">
      <div className="px-4 py-2.5 border-b border-hairline">
        <Skeleton className={`h-[0.6875rem] ${titleWidth}`} />
      </div>
      <ul className="divide-y divide-hairline">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="px-4 py-3 flex items-baseline justify-between gap-4">
            <Skeleton className="h-[0.8125rem] w-3/5" />
            <Skeleton className="h-[0.6875rem] w-10 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-hairline rounded-md overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-hairline bg-panel">
            <th className="px-4 py-2.5">
              <Skeleton className="h-[0.625rem] w-16" />
            </th>
            <th className="px-4 py-2.5 text-right w-24">
              <Skeleton className="h-[0.625rem] w-10 ml-auto" />
            </th>
            <th className="px-4 py-2.5 text-right w-28">
              <Skeleton className="h-[0.625rem] w-14 ml-auto" />
            </th>
            <th className="px-4 py-2.5 text-right w-32">
              <Skeleton className="h-[0.625rem] w-20 ml-auto" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <Skeleton className="h-[0.8125rem] w-2/5" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="h-[0.6875rem] w-8 ml-auto" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="h-[0.6875rem] w-10 ml-auto" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="h-[0.6875rem] w-12 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsPageSkeleton({ rangeDays }: { rangeDays: number }) {
  return (
    <>
      <section className="mb-10 pt-8 border-t border-hairline">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">
            Daily activity
          </span>
          <span className="font-mono text-[0.625rem] text-fog-dim">{rangeDays} days</span>
        </div>
        <ActivitySparkbarSkeleton bars={rangeDays > 45 ? 90 : 30} heightClass="h-16" />
      </section>

      <section className="mb-10 pt-8 border-t border-hairline">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog block mb-4">
          Reliability
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReliabilityPanelSkeleton titleWidth="w-24" />
          <ReliabilityPanelSkeleton titleWidth="w-32" />
        </div>
      </section>

      <section className="pt-8 border-t border-hairline">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">
            Workflow leaderboard
          </span>
          <Skeleton className="h-[0.625rem] w-20" />
        </div>
        <LeaderboardSkeleton rows={5} />
      </section>
    </>
  );
}
