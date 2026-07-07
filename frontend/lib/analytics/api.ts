import { db } from "@/lib/db";
import { runEvents, workflowRuns, workflows } from "@/lib/db/schema/app";
import { and, eq, gte } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export interface DailyActivity {
  date: string;
  total: number;
  completed: number;
  failed: number;
}

export interface WorkflowLeaderboardEntry {
  workflowId: string;
  workflowName: string;
  totalRuns: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

export interface ReliabilityEntry {
  workflowId: string;
  workflowName: string;
  successRate: number;
}

export interface AnalyticsSummary {
  rangeDays: number;
  dailyActivity: DailyActivity[];
  overallSuccessRate: number | null;
  totalRuns: number;
  avgDurationMs: number | null;
  healRate: number | null;
  workflowLeaderboard: WorkflowLeaderboardEntry[];
  mostReliable: ReliabilityEntry[];
  leastReliable: ReliabilityEntry[];
}

interface WorkflowAgg {
  workflowId: string;
  workflowName: string;
  totalRuns: number;
  terminalRuns: number;
  completedRuns: number;
  durationSumMs: number;
  durationCount: number;
}

export async function getAnalyticsSummary(userId: string, days: number): Promise<AnalyticsSummary> {
  const now = Date.now();
  const rangeStart = new Date(now - (days - 1) * DAY_MS);

  const dailyActivity: DailyActivity[] = [];
  const activityByDay = new Map<string, DailyActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const entry: DailyActivity = {
      date: dayKey(new Date(now - i * DAY_MS)),
      total: 0,
      completed: 0,
      failed: 0,
    };
    dailyActivity.push(entry);
    activityByDay.set(entry.date, entry);
  }

  const [runRows, healedRows] = await Promise.all([
    db
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        startedAt: workflowRuns.startedAt,
        endedAt: workflowRuns.endedAt,
        workflowId: workflowRuns.workflowId,
        workflowName: workflows.name,
      })
      .from(workflowRuns)
      .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
      .where(and(eq(workflowRuns.userId, userId), gte(workflowRuns.startedAt, rangeStart))),
    db
      .selectDistinct({ runId: runEvents.runId })
      .from(runEvents)
      .innerJoin(workflowRuns, eq(workflowRuns.id, runEvents.runId))
      .where(
        and(
          eq(workflowRuns.userId, userId),
          eq(runEvents.type, "step_healed"),
          gte(workflowRuns.startedAt, rangeStart),
        ),
      ),
  ]);

  const healedRunIds = new Set(healedRows.map((row) => row.runId));

  let terminalRuns = 0;
  let completedTerminal = 0;
  let durationSumMs = 0;
  let durationCount = 0;
  let healedRunCount = 0;

  const workflowMap = new Map<string, WorkflowAgg>();

  for (const row of runRows) {
    const key = dayKey(row.startedAt);
    const bucket = activityByDay.get(key);
    if (bucket) {
      bucket.total++;
      if (row.status === "completed") bucket.completed++;
      if (row.status === "failed") bucket.failed++;
    }

    if (healedRunIds.has(row.id)) healedRunCount++;

    if (isTerminalStatus(row.status)) {
      terminalRuns++;
      if (row.status === "completed") completedTerminal++;
    }

    if (row.status === "completed" && row.endedAt) {
      const ms = row.endedAt.getTime() - row.startedAt.getTime();
      if (ms >= 0) {
        durationSumMs += ms;
        durationCount++;
      }
    }

    const agg = workflowMap.get(row.workflowId) ?? {
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      totalRuns: 0,
      terminalRuns: 0,
      completedRuns: 0,
      durationSumMs: 0,
      durationCount: 0,
    };
    agg.totalRuns++;
    if (isTerminalStatus(row.status)) {
      agg.terminalRuns++;
      if (row.status === "completed") agg.completedRuns++;
    }
    if (row.status === "completed" && row.endedAt) {
      const ms = row.endedAt.getTime() - row.startedAt.getTime();
      if (ms >= 0) {
        agg.durationSumMs += ms;
        agg.durationCount++;
      }
    }
    workflowMap.set(row.workflowId, agg);
  }

  const totalRuns = runRows.length;

  const workflowLeaderboard: WorkflowLeaderboardEntry[] = Array.from(workflowMap.values())
    .map((agg) => ({
      workflowId: agg.workflowId,
      workflowName: agg.workflowName,
      totalRuns: agg.totalRuns,
      successRate:
        agg.terminalRuns > 0 ? Math.round((agg.completedRuns / agg.terminalRuns) * 100) : null,
      avgDurationMs:
        agg.durationCount > 0 ? Math.round(agg.durationSumMs / agg.durationCount) : null,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns);

  const qualified = workflowLeaderboard
    .filter((entry) => {
      const agg = workflowMap.get(entry.workflowId)!;
      return agg.terminalRuns >= 2 && entry.successRate !== null;
    })
    .sort((a, b) => b.successRate! - a.successRate!);

  const mostReliable: ReliabilityEntry[] = qualified.slice(0, 3).map((entry) => ({
    workflowId: entry.workflowId,
    workflowName: entry.workflowName,
    successRate: entry.successRate!,
  }));

  const topIds = new Set(mostReliable.map((entry) => entry.workflowId));
  const leastReliable: ReliabilityEntry[] = qualified
    .filter((entry) => !topIds.has(entry.workflowId))
    .slice(-3)
    .reverse()
    .map((entry) => ({
      workflowId: entry.workflowId,
      workflowName: entry.workflowName,
      successRate: entry.successRate!,
    }));

  return {
    rangeDays: days,
    dailyActivity,
    overallSuccessRate:
      terminalRuns > 0 ? Math.round((completedTerminal / terminalRuns) * 100) : null,
    totalRuns,
    avgDurationMs: durationCount > 0 ? Math.round(durationSumMs / durationCount) : null,
    healRate: totalRuns > 0 ? Math.round((healedRunCount / totalRuns) * 100) : null,
    workflowLeaderboard,
    mostReliable,
    leastReliable,
  };
}
