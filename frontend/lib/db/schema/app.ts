import type { WorkflowStep } from "@/types/workflow";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export interface WorkflowDefinition {
  parameters: string[];
  steps: WorkflowStep[];
}

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("workflows_user_id_name_idx").on(table.userId, table.name)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workerRunId: text("worker_run_id"),
    status: text("status").notNull().default("running"),
    params: jsonb("params").$type<Record<string, string>>().notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    extracts: jsonb("extracts").$type<Record<string, unknown>>(),
    error: text("error"),
  },
  (table) => [
    index("workflow_runs_user_id_idx").on(table.userId),
    index("workflow_runs_workflow_id_idx").on(table.workflowId),
  ],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    stepIndex: integer("step_index"),
    stepType: text("step_type"),
    message: text("message"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => [index("run_events_run_id_idx").on(table.runId)],
);

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(user, { fields: [workflows.userId], references: [user.id] }),
  runs: many(workflowRuns),
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one, many }) => ({
  workflow: one(workflows, { fields: [workflowRuns.workflowId], references: [workflows.id] }),
  user: one(user, { fields: [workflowRuns.userId], references: [user.id] }),
  events: many(runEvents),
}));

export const runEventsRelations = relations(runEvents, ({ one }) => ({
  run: one(workflowRuns, { fields: [runEvents.runId], references: [workflowRuns.id] }),
}));

export type WorkflowRow = typeof workflows.$inferSelect;
export type NewWorkflowRow = typeof workflows.$inferInsert;
export type WorkflowRunRow = typeof workflowRuns.$inferSelect;
export type NewWorkflowRunRow = typeof workflowRuns.$inferInsert;
export type RunEventRow = typeof runEvents.$inferSelect;
export type NewRunEventRow = typeof runEvents.$inferInsert;
