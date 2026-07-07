import type { CreateWorkflowInput, PatchWorkflowInput } from "@/lib/workflows/schemas";
import type { Workflow } from "@/types/workflow";

export class WorkflowApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string") return body.error;
  } catch {
    // ignore
  }
  return res.statusText || "Request failed";
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new WorkflowApiError("Unauthorized", 401);
  }
  if (!res.ok) {
    throw new WorkflowApiError(await readErrorMessage(res), res.status);
  }
  return res.json() as Promise<T>;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await fetch("/api/workflows");
  return handleResponse(res);
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}`);
  return handleResponse(res);
}

export async function createWorkflow(input: CreateWorkflowInput): Promise<Workflow> {
  const res = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function patchWorkflow(id: string, patch: PatchWorkflowInput): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
  await handleResponse(res);
}
