import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/app";
import {
  getSessionOrNull,
  isUniqueViolation,
  rowToWorkflow,
} from "@/lib/workflows/api";
import { patchWorkflowSchema } from "@/lib/workflows/schemas";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedWorkflow(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await getOwnedWorkflow(session.user.id, id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rowToWorkflow(row));
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await getOwnedWorkflow(session.user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, description, parameters, steps } = parsed.data;
  const definition =
    parameters !== undefined || steps !== undefined
      ? {
          parameters: parameters ?? existing.definition.parameters,
          steps: steps ?? existing.definition.steps,
        }
      : undefined;

  try {
    const [row] = await db
      .update(workflows)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(definition !== undefined ? { definition } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, id), eq(workflows.userId, session.user.id)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rowToWorkflow(row));
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

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, session.user.id)))
    .returning({ id: workflows.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
