import { getDashboardSummary } from "@/lib/runs/api";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDashboardSummary(session.user.id);
  return NextResponse.json(summary);
}
