import { listUserRuns } from "@/lib/runs/api";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const workflowId = searchParams.get("workflowId") ?? undefined;
  const before = searchParams.get("before") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const runs = await listUserRuns(session.user.id, { status, workflowId, before, limit });

  return NextResponse.json(
    runs.map((run) => ({
      ...run,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
    })),
  );
}
