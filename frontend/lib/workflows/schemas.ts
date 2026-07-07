import type { WorkflowStep } from "@/types/workflow";
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

const extractMethodSchema = z.enum(["selectors", "code", "screenshot", "html", "llm"]);

export const workflowStepSchema: z.ZodType<WorkflowStep> = z.object({
  type: stepTypeSchema,
  instruction: z.string(),
  command: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  task: z.string().optional(),
  method: extractMethodSchema.optional(),
  extraction_selectors: z.record(z.string(), z.string()).optional(),
  extractor_fn: z.string().optional(),
  extract_instruction: z.string().optional(),
  extraction_format: z.record(z.string(), z.unknown()).optional(),
  scroll_x: z.number().optional(),
  scroll_y: z.number().optional(),
  sleep_before: z.number(),
  duration: z.number(),
  skip_command: z.boolean(),
  max_retries: z.number(),
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().default(""),
  parameters: z.array(z.string()).optional().default([]),
  steps: z.array(workflowStepSchema).optional().default([]),
});

export const patchWorkflowSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  parameters: z.array(z.string()).optional(),
  steps: z.array(workflowStepSchema).optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type PatchWorkflowInput = z.infer<typeof patchWorkflowSchema>;
