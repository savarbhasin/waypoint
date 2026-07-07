import { getOwnedRun } from "@/lib/runs/api";
import { cancelWorkerRun } from "@/lib/runs/worker-client";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const run = await getOwnedRun(session.user.id, id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.workerRunId) {
    await cancelWorkerRun(run.workerRunId);
  }

  return NextResponse.json({ ok: true });
}
