import { getOwnedRun, getRunHistory } from "@/lib/runs/api";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const run = await getOwnedRun(session.user.id, id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await getRunHistory(id);

  return NextResponse.json({
    status: run.status,
    history,
  });
}
