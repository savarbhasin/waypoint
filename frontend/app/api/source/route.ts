import { NextRequest, NextResponse } from "next/server";
import { readSourceSnippet } from "@/lib/readSource";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const start = parseInt(req.nextUrl.searchParams.get("start") ?? "1", 10);
  const end = parseInt(req.nextUrl.searchParams.get("end") ?? "20", 10);

  if (!file || !file.startsWith("src/")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  const snippet = readSourceSnippet(file, start, end);
  if (!snippet) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({ snippet });
}
