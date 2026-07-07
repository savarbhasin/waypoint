import { db } from "@/lib/db";
import type { RunEventRow, WorkflowRunRow } from "@/lib/db/schema/app";
import { runEvents, workflowRuns, workflows } from "@/lib/db/schema/app";
import type { RunEvent } from "@/lib/runs/types";
import { and, asc, desc, eq, lt } from "drizzle-orm";

export function rowToRunEvent(row: RunEventRow, dbRunId: string): RunEvent {
  return {
    type: row.type as RunEvent["type"],
    run_id: dbRunId,
    step_index: row.stepIndex,
    step_type: row.stepType,
    message: row.message,
    data: row.data ?? null,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function getOwnedWorkflow(userId: string, workflowId: string) {
  const [row] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function getOwnedRun(userId: string, runId: string) {
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function getRunHistory(dbRunId: string): Promise<RunEvent[]> {
  const rows = await db
    .select()
    .from(runEvents)
    .where(eq(runEvents.runId, dbRunId))
    .orderBy(asc(runEvents.timestamp));

  return rows.map((row) => rowToRunEvent(row, dbRunId));
}

export type RunSummary = Pick<
  WorkflowRunRow,
  "id" | "status" | "startedAt" | "endedAt" | "params"
>;

export function toRunSummary(row: WorkflowRunRow): RunSummary {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    params: row.params,
  };
}

export async function listWorkflowRuns(userId: string, workflowId: string): Promise<RunSummary[]> {
  const rows = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.workflowId, workflowId), eq(workflowRuns.userId, userId)))
    .orderBy(desc(workflowRuns.startedAt));

  return rows.map(toRunSummary);
}

export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export interface UserRunSummary extends RunSummary {
  workflowId: string;
  workflowName: string;
  error: string | null;
}

export interface DashboardSummary {
  stats: {
    runningCount: number;
    runsToday: number;
    successRate7d: number | null;
    workflowCount: number;
  };
  activity: { date: string; total: number; failed: number }[];
  attention: {
    id: string;
    workflowId: string;
    workflowName: string;
    startedAt: string;
    error: string | null;
  }[];
  workflowStats: Record<
    string,
    { lastRun: { status: string; startedAt: string } | null; totalRuns: number; successRate: number | null }
  >;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [runRows, workflowCountRows] = await Promise.all([
    db
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        startedAt: workflowRuns.startedAt,
        endedAt: workflowRuns.endedAt,
        error: workflowRuns.error,
        workflowId: workflowRuns.workflowId,
        workflowName: workflows.name,
      })
      .from(workflowRuns)
      .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
      .where(eq(workflowRuns.userId, userId))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(1000),
    db.select({ id: workflows.id }).from(workflows).where(eq(workflows.userId, userId)),
  ]);

  const now = Date.now();
  const todayKey = dayKey(new Date(now));
  const sevenDaysAgo = now - 7 * DAY_MS;

  let runningCount = 0;
  let runsToday = 0;
  let success7d = 0;
  let terminal7d = 0;

  const activityByDay = new Map<string, { total: number; failed: number }>();
  for (let i = 13; i >= 0; i--) {
    activityByDay.set(dayKey(new Date(now - i * DAY_MS)), { total: 0, failed: 0 });
  }

  const workflowStats: DashboardSummary["workflowStats"] = {};
  const attention: DashboardSummary["attention"] = [];

  for (const row of runRows) {
    const startedMs = row.startedAt.getTime();
    const key = dayKey(row.startedAt);

    if (row.status === "running") runningCount++;
    if (key === todayKey) runsToday++;

    if (isTerminalStatus(row.status) && startedMs >= sevenDaysAgo) {
      terminal7d++;
      if (row.status === "completed") success7d++;
    }

    const bucket = activityByDay.get(key);
    if (bucket) {
      bucket.total++;
      if (row.status === "failed") bucket.failed++;
    }

    const stat = (workflowStats[row.workflowId] ??= { lastRun: null, totalRuns: 0, successRate: null });
    stat.totalRuns++;
    if (!stat.lastRun) {
      stat.lastRun = { status: row.status, startedAt: row.startedAt.toISOString() };
    }

    if (row.status === "failed" && attention.length < 5) {
      attention.push({
        id: row.id,
        workflowId: row.workflowId,
        workflowName: row.workflowName,
        startedAt: row.startedAt.toISOString(),
        error: row.error,
      });
    }
  }

  for (const [workflowId, stat] of Object.entries(workflowStats)) {
    const rows = runRows.filter((r) => r.workflowId === workflowId && isTerminalStatus(r.status));
    const completed = rows.filter((r) => r.status === "completed").length;
    stat.successRate = rows.length > 0 ? Math.round((completed / rows.length) * 100) : null;
  }

  return {
    stats: {
      runningCount,
      runsToday,
      successRate7d: terminal7d > 0 ? Math.round((success7d / terminal7d) * 100) : null,
      workflowCount: workflowCountRows.length,
    },
    activity: Array.from(activityByDay.entries()).map(([date, v]) => ({ date, ...v })),
    attention,
    workflowStats,
  };
}

export async function listUserRuns(
  userId: string,
  options: { status?: string; workflowId?: string; before?: string; limit?: number } = {},
): Promise<UserRunSummary[]> {
  const conditions = [eq(workflowRuns.userId, userId)];
  if (options.status) conditions.push(eq(workflowRuns.status, options.status));
  if (options.workflowId) conditions.push(eq(workflowRuns.workflowId, options.workflowId));
  if (options.before) conditions.push(lt(workflowRuns.startedAt, new Date(options.before)));

  const rows = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      startedAt: workflowRuns.startedAt,
      endedAt: workflowRuns.endedAt,
      params: workflowRuns.params,
      error: workflowRuns.error,
      workflowId: workflowRuns.workflowId,
      workflowName: workflows.name,
    })
    .from(workflowRuns)
    .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
    .where(and(...conditions))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(options.limit ?? 50);

  return rows;
}
