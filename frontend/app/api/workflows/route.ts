import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/app";
import { extractBearerToken, verifyToken } from "@/lib/tokens";
import {
  getSessionOrNull,
  isUniqueViolation,
  rowToWorkflow,
} from "@/lib/workflows/api";
import { createWorkflowSchema } from "@/lib/workflows/schemas";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function getUserIdForRequest(request: Request): Promise<string | null> {
  const session = await getSessionOrNull();
  if (session) return session.user.id;

  const token = extractBearerToken(request);
  if (!token) return null;

  const auth = await verifyToken(token);
  return auth?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = await getUserIdForRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.updatedAt));

  return NextResponse.json(rows.map(rowToWorkflow));
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, description, parameters, steps } = parsed.data;

  try {
    const [row] = await db
      .insert(workflows)
      .values({
        userId: session.user.id,
        name,
        description,
        definition: { parameters, steps },
      })
      .returning();

    return NextResponse.json(rowToWorkflow(row), { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A workflow with this name already exists" },
        { status: 409 },
      );
    }
    throw error;
  }
}
