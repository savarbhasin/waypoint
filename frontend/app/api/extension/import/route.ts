import { enrichWorkflow } from "@/lib/enrichment";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema/app";
import { verifyToken } from "@/lib/tokens";
import { isUniqueViolation } from "@/lib/workflows/api";
import { STEP_DEFAULTS } from "@/types/workflow";
import type { WorkflowStep } from "@/types/workflow";
import { NextResponse } from "next/server";
import { z } from "zod";

const stepTypeSchema = z.enum([
  "navigate",
  "click",
  "fill",
  "select",
  "scroll",
  "ai",
  "extract",
  "wait",
]);

const rawStepSchema = z.object({
  type: stepTypeSchema,
  instruction: z.string(),
  command: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  scroll_x: z.number().optional(),
  scroll_y: z.number().optional(),
  sleep_before: z.number().optional(),
  duration: z.number().optional(),
  skip_command: z.boolean().optional(),
  max_retries: z.number().optional(),
});

const importSchema = z.object({
  name: z.string().trim().min(1),
  steps: z.array(rawStepSchema).min(1),
});

function normalizeRawStep(raw: z.infer<typeof rawStepSchema>): WorkflowStep {
  return {
    type: raw.type,
    instruction: raw.instruction,
    command: raw.command,
    url: raw.url,
    value: raw.value,
    scroll_x: raw.scroll_x,
    scroll_y: raw.scroll_y,
    sleep_before: raw.sleep_before ?? STEP_DEFAULTS.sleep_before,
    duration: raw.duration ?? STEP_DEFAULTS.duration,
    skip_command: raw.skip_command ?? STEP_DEFAULTS.skip_command,
    max_retries: raw.max_retries ?? STEP_DEFAULTS.max_retries,
  };
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function insertWorkflow(userId: string, name: string, description: string, steps: WorkflowStep[], parameters: string[]) {
  const [row] = await db
    .insert(workflows)
    .values({
      userId,
      name,
      description,
      definition: { parameters, steps },
    })
    .returning({ id: workflows.id, name: workflows.name });

  return row;
}

export async function POST(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const auth = await verifyToken(token);
  if (!auth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rawSteps = parsed.data.steps.map(normalizeRawStep);

  let enriched;
  try {
    enriched = await enrichWorkflow(parsed.data.name, rawSteps);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enrichment failed";
    return NextResponse.json({ error: `Workflow enrichment failed: ${message}` }, { status: 502 });
  }

  const baseName = enriched.name.trim() || parsed.data.name;

  try {
    const row = await insertWorkflow(
      auth.userId,
      baseName,
      enriched.description,
      enriched.steps,
      enriched.parameters,
    );
    return NextResponse.json({ id: row.id, name: row.name }, { status: 201 });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const suffixName = `${baseName}_2`;
    try {
      const row = await insertWorkflow(
        auth.userId,
        suffixName,
        enriched.description,
        enriched.steps,
        enriched.parameters,
      );
      return NextResponse.json({ id: row.id, name: row.name }, { status: 201 });
    } catch (retryError) {
      if (isUniqueViolation(retryError)) {
        return NextResponse.json({ error: "A workflow with this name already exists" }, { status: 409 });
      }
      throw retryError;
    }
  }
}
