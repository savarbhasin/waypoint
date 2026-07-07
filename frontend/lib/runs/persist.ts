import { db } from "@/lib/db";
import { runEvents, workflowRuns } from "@/lib/db/schema/app";
import { runHub } from "@/lib/runs/hub";
import type { RunEvent } from "@/lib/runs/types";
import { isTerminalEvent } from "@/lib/runs/types";
import { consumeWorkerRun } from "@/lib/runs/worker-client";
import { eq } from "drizzle-orm";

function remapEvent(event: RunEvent, dbRunId: string): RunEvent {
  return { ...event, run_id: dbRunId };
}

async function persistEvent(dbRunId: string, event: RunEvent): Promise<void> {
  if (event.type === "frame") {
    return;
  }

  await db.insert(runEvents).values({
    runId: dbRunId,
    type: event.type,
    stepIndex: event.step_index,
    stepType: event.step_type,
    message: event.message,
    data: event.data,
    timestamp: new Date(event.timestamp),
  });

  if (event.type === "run_completed") {
    await db
      .update(workflowRuns)
      .set({
        status: "completed",
        endedAt: new Date(),
        extracts: (event.data?.extracts as Record<string, unknown> | undefined) ?? null,
      })
      .where(eq(workflowRuns.id, dbRunId));
    return;
  }

  if (event.type === "run_failed") {
    await db
      .update(workflowRuns)
      .set({
        status: "failed",
        endedAt: new Date(),
        error: typeof event.data?.error === "string" ? event.data.error : "unknown error",
      })
      .where(eq(workflowRuns.id, dbRunId));
  }
}

async function markConnectionLost(dbRunId: string): Promise<void> {
  const now = new Date();
  await db
    .update(workflowRuns)
    .set({
      status: "failed",
      endedAt: now,
      error: "connection to worker lost",
    })
    .where(eq(workflowRuns.id, dbRunId));

  const synthetic: RunEvent = {
    type: "run_failed",
    run_id: dbRunId,
    step_index: null,
    step_type: null,
    message: null,
    data: { error: "connection to worker lost" },
    timestamp: now.toISOString(),
  };

  runHub.publish(dbRunId, synthetic);
}

export async function handleRunEvent(dbRunId: string, event: RunEvent): Promise<void> {
  const remapped = remapEvent(event, dbRunId);
  await persistEvent(dbRunId, remapped);
  runHub.publish(dbRunId, remapped);
}

export function startRunPersistence(dbRunId: string, workerRunId: string): void {
  void (async () => {
    let terminal = false;

    try {
      await consumeWorkerRun(workerRunId, async (event) => {
        await handleRunEvent(dbRunId, event);
        if (isTerminalEvent(event)) {
          terminal = true;
        }
      });

      if (!terminal) {
        await markConnectionLost(dbRunId);
      }
    } catch {
      if (!terminal) {
        await markConnectionLost(dbRunId);
      }
    }
  })();
}
