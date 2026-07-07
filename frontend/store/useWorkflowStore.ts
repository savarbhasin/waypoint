import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workflow, WorkflowStep } from "@/types/workflow";
import { seedWorkflows } from "@/data/seedWorkflows";

interface WorkflowStore {
  workflows: Workflow[];
  addWorkflow: (wf: Workflow) => void;
  removeWorkflow: (name: string) => void;
  updateWorkflow: (name: string, patch: Partial<Workflow>) => void;
  renameWorkflow: (oldName: string, newName: string) => void;
  addStep: (workflowName: string, step: WorkflowStep, atIndex?: number) => void;
  updateStep: (workflowName: string, index: number, patch: Partial<WorkflowStep>) => void;
  removeStep: (workflowName: string, index: number) => void;
  moveStep: (workflowName: string, from: number, to: number) => void;
  duplicateStep: (workflowName: string, index: number) => void;
  importWorkflow: (wf: Workflow) => void;
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set) => ({
      workflows: seedWorkflows,
      addWorkflow: (wf) => set((s) => ({ workflows: [...s.workflows, wf] })),
      removeWorkflow: (name) => set((s) => ({ workflows: s.workflows.filter((w) => w.name !== name) })),
      updateWorkflow: (name, patch) =>
        set((s) => ({ workflows: s.workflows.map((w) => (w.name === name ? { ...w, ...patch } : w)) })),
      renameWorkflow: (oldName, newName) =>
        set((s) => ({ workflows: s.workflows.map((w) => (w.name === oldName ? { ...w, name: newName } : w)) })),
      addStep: (workflowName, step, atIndex) =>
        set((s) => ({
          workflows: s.workflows.map((w) => {
            if (w.name !== workflowName) return w;
            const steps = [...w.steps];
            if (atIndex === undefined) steps.push(step);
            else steps.splice(atIndex, 0, step);
            return { ...w, steps };
          }),
        })),
      updateStep: (workflowName, index, patch) =>
        set((s) => ({
          workflows: s.workflows.map((w) => {
            if (w.name !== workflowName) return w;
            return { ...w, steps: w.steps.map((st, i) => (i === index ? { ...st, ...patch } : st)) };
          }),
        })),
      removeStep: (workflowName, index) =>
        set((s) => ({
          workflows: s.workflows.map((w) => {
            if (w.name !== workflowName) return w;
            return { ...w, steps: w.steps.filter((_, i) => i !== index) };
          }),
        })),
      moveStep: (workflowName, from, to) =>
        set((s) => ({
          workflows: s.workflows.map((w) => {
            if (w.name !== workflowName) return w;
            const steps = [...w.steps];
            const [moved] = steps.splice(from, 1);
            steps.splice(to, 0, moved);
            return { ...w, steps };
          }),
        })),
      duplicateStep: (workflowName, index) =>
        set((s) => ({
          workflows: s.workflows.map((w) => {
            if (w.name !== workflowName) return w;
            const steps = [...w.steps];
            steps.splice(index + 1, 0, { ...steps[index] });
            return { ...w, steps };
          }),
        })),
      importWorkflow: (wf) =>
        set((s) => {
          const exists = s.workflows.some((w) => w.name === wf.name);
          const name = exists ? `${wf.name}_imported` : wf.name;
          return { workflows: [...s.workflows, { ...wf, name }] };
        }),
    }),
    { name: "waypoint-workflows" }
  )
);
