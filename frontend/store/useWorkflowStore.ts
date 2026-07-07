import { create } from "zustand";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  patchWorkflow,
  WorkflowApiError,
} from "@/lib/workflows/client";
import type { CreateWorkflowInput, PatchWorkflowInput } from "@/lib/workflows/schemas";
import type { Workflow, WorkflowStep } from "@/types/workflow";

interface WorkflowStore {
  workflows: Workflow[];
  loading: boolean;
  initialized: boolean;
  unauthorized: boolean;
  error: string | null;
  fetchWorkflows: () => Promise<void>;
  fetchWorkflow: (id: string) => Promise<Workflow | null>;
  addWorkflow: (input: CreateWorkflowInput) => Promise<Workflow>;
  removeWorkflow: (id: string) => Promise<void>;
  updateWorkflow: (id: string, patch: PatchWorkflowInput) => Promise<void>;
  renameWorkflow: (id: string, newName: string) => Promise<void>;
  addStep: (workflowId: string, step: WorkflowStep, atIndex?: number) => Promise<void>;
  updateStep: (workflowId: string, index: number, patch: Partial<WorkflowStep>) => Promise<void>;
  removeStep: (workflowId: string, index: number) => Promise<void>;
  moveStep: (workflowId: string, from: number, to: number) => Promise<void>;
  duplicateStep: (workflowId: string, index: number) => Promise<void>;
  importWorkflow: (input: CreateWorkflowInput) => Promise<Workflow>;
}

async function persistWorkflow(
  id: string,
  patch: PatchWorkflowInput,
  set: (partial: Partial<WorkflowStore> | ((state: WorkflowStore) => Partial<WorkflowStore>)) => void,
  get: () => WorkflowStore,
) {
  const previous = get().workflows;
  set((s) => ({
    workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
  }));

  try {
    const updated = await patchWorkflow(id, patch);
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
    }));
  } catch (err) {
    set({ workflows: previous });
    throw err;
  }
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  loading: false,
  initialized: false,
  unauthorized: false,
  error: null,

  fetchWorkflows: async () => {
    set({ loading: true, error: null });
    try {
      const workflows = await listWorkflows();
      set({ workflows, loading: false, initialized: true, unauthorized: false });
    } catch (err) {
      if (err instanceof WorkflowApiError && err.status === 401) {
        set({ workflows: [], loading: false, initialized: true, unauthorized: true, error: null });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to load workflows";
      set({ loading: false, initialized: true, error: message });
    }
  },

  fetchWorkflow: async (id) => {
    const cached = get().workflows.find((w) => w.id === id);
    if (cached) return cached;

    try {
      const workflow = await getWorkflow(id);
      set((s) => ({
        workflows: [...s.workflows.filter((w) => w.id !== id), workflow],
        unauthorized: false,
      }));
      return workflow;
    } catch (err) {
      if (err instanceof WorkflowApiError && err.status === 401) {
        set({ unauthorized: true });
        return null;
      }
      throw err;
    }
  },

  addWorkflow: async (input) => {
    const workflow = await createWorkflow(input);
    set((s) => ({ workflows: [...s.workflows, workflow], unauthorized: false }));
    return workflow;
  },

  removeWorkflow: async (id) => {
    const previous = get().workflows;
    set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) }));
    try {
      await deleteWorkflow(id);
    } catch (err) {
      set({ workflows: previous });
      throw err;
    }
  },

  updateWorkflow: async (id, patch) => {
    await persistWorkflow(id, patch, set, get);
  },

  renameWorkflow: async (id, newName) => {
    await get().updateWorkflow(id, { name: newName });
  },

  addStep: async (workflowId, step, atIndex) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    const steps = [...workflow.steps];
    if (atIndex === undefined) steps.push(step);
    else steps.splice(atIndex, 0, step);
    await persistWorkflow(workflowId, { steps }, set, get);
  },

  updateStep: async (workflowId, index, patch) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    const steps = workflow.steps.map((st, i) => (i === index ? { ...st, ...patch } : st));
    await persistWorkflow(workflowId, { steps }, set, get);
  },

  removeStep: async (workflowId, index) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    await persistWorkflow(workflowId, { steps: workflow.steps.filter((_, i) => i !== index) }, set, get);
  },

  moveStep: async (workflowId, from, to) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    const steps = [...workflow.steps];
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    await persistWorkflow(workflowId, { steps }, set, get);
  },

  duplicateStep: async (workflowId, index) => {
    const workflow = get().workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    const steps = [...workflow.steps];
    steps.splice(index + 1, 0, { ...steps[index] });
    await persistWorkflow(workflowId, { steps }, set, get);
  },

  importWorkflow: async (input) => {
    const exists = get().workflows.some((w) => w.name === input.name);
    const payload = exists ? { ...input, name: `${input.name}_imported` } : input;
    return get().addWorkflow(payload);
  },
}));
