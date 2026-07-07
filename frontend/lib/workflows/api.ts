import { auth } from "@/lib/auth";
import type { WorkflowRow } from "@/lib/db/schema/app";
import type { Workflow } from "@/types/workflow";
import { headers } from "next/headers";

export type WorkflowResponse = Workflow & { id: string };

export function rowToWorkflow(row: WorkflowRow): WorkflowResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.createdAt.toISOString(),
    parameters: row.definition.parameters,
    steps: row.definition.steps,
  };
}

export async function getSessionOrNull() {
  return auth.api.getSession({ headers: await headers() });
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505" || causeCode === "23505";
}
