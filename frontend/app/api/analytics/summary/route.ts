import { getAnalyticsSummary } from "@/lib/analytics/api";
import { getSessionOrNull } from "@/lib/workflows/api";
import { NextResponse } from "next/server";

function parseDays(raw: string | null): number {
  const parsed = parseInt(raw ?? "30", 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(365, Math.max(1, parsed));
}

export async function GET(request: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseDays(searchParams.get("days"));
  const summary = await getAnalyticsSummary(session.user.id, days);
  return NextResponse.json(summary);
}
