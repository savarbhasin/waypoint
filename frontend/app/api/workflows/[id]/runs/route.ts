import { db } from "@/lib/db";
import { workflowRuns } from "@/lib/db/schema/app";
import {
  getOwnedWorkflow,
  listWorkflowRuns,
} from "@/lib/runs/api";
import { startRunPersistence } from "@/lib/runs/persist";
import { startWorkerRun } from "@/lib/runs/worker-client";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const startRunSchema = z.object({
  params: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workflowId } = await context.params;
  const row = await getOwnedWorkflow(session.user.id, workflowId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = {
    name: row.name,
    description: row.description,
    created_at: row.createdAt.toISOString(),
    parameters: row.definition.parameters,
    steps: row.definition.steps,
  };

  let workerRunId: string;
  try {
    const workerResponse = await startWorkerRun(workflow, parsed.data.params);
    workerRunId = workerResponse.run_id;
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : 502;

    return NextResponse.json(
      {
        error:
          status === 400
            ? "Worker rejected run request"
            : "Worker unavailable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: status === 400 ? 400 : 502 },
    );
  }

  const [runRow] = await db
    .insert(workflowRuns)
    .values({
      workflowId: row.id,
      userId: session.user.id,
      workerRunId,
      status: "running",
      params: parsed.data.params,
      startedAt: new Date(),
    })
    .returning();

  startRunPersistence(runRow.id, workerRunId);

  return NextResponse.json({ run_id: runRow.id }, { status: 201 });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workflowId } = await context.params;
  const row = await getOwnedWorkflow(session.user.id, workflowId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await listWorkflowRuns(session.user.id, workflowId);
  return NextResponse.json(
    runs.map((run) => ({
      ...run,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
    })),
  );
}
