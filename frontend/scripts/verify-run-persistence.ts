/**
 * Standalone verification: starts a worker run and persists events to Postgres.
 * Usage (from frontend/): npx tsx scripts/verify-run-persistence.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { runEvents, workflowRuns, workflows } from "../lib/db/schema/app";
import { user } from "../lib/db/schema/auth";
import { getRunHistory } from "../lib/runs/api";
import { handleRunEvent } from "../lib/runs/persist";
import { consumeWorkerRun, startWorkerRun } from "../lib/runs/worker-client";
import { asc, eq } from "drizzle-orm";

const TEST_USER_ID = "verify-run-user";

const minimalWorkflow = {
  name: "verify-run",
  description: "persistence smoke test",
  created_at: new Date().toISOString(),
  parameters: [] as string[],
  steps: [
    {
      type: "navigate" as const,
      instruction: "Go to example.com",
      url: "https://example.com",
      sleep_before: 0,
      duration: 0,
      skip_command: false,
      max_retries: 0,
    },
  ],
};

async function ensureUser() {
  const existing = await db.select().from(user).where(eq(user.id, TEST_USER_ID)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const [row] = await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Verify Run User",
      email: "verify-run@example.com",
    })
    .returning();

  return row;
}

async function ensureWorkflow() {
  const existing = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, TEST_USER_ID))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [row] = await db
    .insert(workflows)
    .values({
      userId: TEST_USER_ID,
      name: "verify-run",
      description: "persistence smoke test",
      definition: {
        parameters: minimalWorkflow.parameters,
        steps: minimalWorkflow.steps,
      },
    })
    .returning();

  return row;
}

async function main() {
  await ensureUser();
  const workflowRow = await ensureWorkflow();

  const workerResponse = await startWorkerRun(minimalWorkflow, {});
  const workerRunId = workerResponse.run_id;
  console.log("worker run started:", workerRunId);

  const [runRow] = await db
    .insert(workflowRuns)
    .values({
      workflowId: workflowRow.id,
      userId: TEST_USER_ID,
      workerRunId,
      status: "running",
      params: {},
      startedAt: new Date(),
    })
    .returning();

  const dbRunId = runRow.id;
  console.log("db run created:", dbRunId);

  let terminal = false;
  await consumeWorkerRun(workerRunId, async (event) => {
    console.log("event:", event.type);
    await handleRunEvent(dbRunId, event);
    if (event.type === "run_completed" || event.type === "run_failed") {
      terminal = true;
    }
  });

  const [finalRun] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, dbRunId))
    .limit(1);

  const events = await db
    .select()
    .from(runEvents)
    .where(eq(runEvents.runId, dbRunId))
    .orderBy(asc(runEvents.timestamp));

  const history = await getRunHistory(dbRunId);

  console.log("\n--- results ---");
  console.log("terminal event received:", terminal);
  console.log("final status:", finalRun?.status);
  console.log("endedAt:", finalRun?.endedAt?.toISOString() ?? null);
  console.log("error:", finalRun?.error ?? null);
  console.log("persisted events:", events.length);
  console.log("history event types:", history.map((e) => e.type).join(", "));

  if (finalRun?.status !== "failed" && finalRun?.status !== "completed") {
    console.error("FAIL: run did not reach terminal status");
    process.exit(1);
  }

  if (!finalRun?.endedAt) {
    console.error("FAIL: endedAt not set");
    process.exit(1);
  }

  if (events.length === 0) {
    console.error("FAIL: no events persisted");
    process.exit(1);
  }

  console.log("PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
