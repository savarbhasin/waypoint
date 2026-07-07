import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema/tokens";
import { generateToken } from "@/lib/tokens";
import { getSessionOrNull } from "@/lib/workflows/api";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).optional().default("Chrome Extension"),
});

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, session.user.id))
    .orderBy(desc(apiTokens.createdAt));

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    })),
  );
}

export async function POST(request: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, hash } = generateToken();

  await db.insert(apiTokens).values({
    userId: session.user.id,
    tokenHash: hash,
    name: parsed.data.name,
  });

  return NextResponse.json({ token }, { status: 201 });
}
