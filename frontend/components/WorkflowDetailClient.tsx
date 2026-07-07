"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useRunSimulation } from "@/hooks/useRunSimulation";
import { StepTimeline } from "@/components/StepTimeline";
import { AddStepMenu } from "@/components/AddStepMenu";
import { StepInspector } from "@/components/StepInspector";
import { ParamsEditor } from "@/components/ParamsEditor";
import { RunPanel } from "@/components/RunPanel";
import { downloadWorkflow } from "@/lib/exportWorkflow";
import { makeStep } from "@/types/workflow";
import type { WorkflowStep } from "@/types/workflow";

export function WorkflowDetailClient({ name }: { name: string }) {
  const decodedName = decodeURIComponent(name);
  const router = useRouter();

  const workflow = useWorkflowStore((s) => s.workflows.find((w) => w.name === decodedName));
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const renameWorkflow = useWorkflowStore((s) => s.renameWorkflow);
  const removeWorkflow = useWorkflowStore((s) => s.removeWorkflow);
  const addStep = useWorkflowStore((s) => s.addStep);
  const updateStep = useWorkflowStore((s) => s.updateStep);
  const removeStep = useWorkflowStore((s) => s.removeStep);
  const moveStep = useWorkflowStore((s) => s.moveStep);
  const duplicateStep = useWorkflowStore((s) => s.duplicateStep);

  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<"inspect" | "run">("run");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState(decodedName);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const sim = useRunSimulation(workflow ?? { name: "", description: "", created_at: "", parameters: [], steps: [] });

  useEffect(() => setNameDraft(decodedName), [decodedName]);
  useEffect(() => setConfirmDelete(false), [decodedName]);

  const stepCount = workflow?.steps.length ?? 0;
  useEffect(() => {
    if (selected !== null && selected >= stepCount) setSelected(stepCount > 0 ? stepCount - 1 : null);
  }, [stepCount, selected]);

  if (!hydrated) return null;

  if (!workflow) {
    router.replace("/");
    return null;
  }

  function commitName() {
    const clean = nameDraft.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!clean || clean === workflow!.name) {
      setNameDraft(workflow!.name);
      return;
    }
    renameWorkflow(workflow!.name, clean);
    router.replace(`/w/${encodeURIComponent(clean)}`);
  }

  function handleAddStep(type: WorkflowStep["type"]) {
    addStep(workflow!.name, makeStep(type));
  }

  function handleSelect(i: number) {
    setSelected(i);
    setTab("inspect");
    document.getElementById(`step-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const selectedStep = selected !== null ? workflow.steps[selected] : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] max-lg:flex max-lg:flex-col min-h-screen max-lg:min-h-screen h-screen max-lg:h-auto">
      <div className="min-w-0 flex flex-col overflow-hidden max-lg:overflow-visible">
        <div className="px-6 pt-5 pb-4 border-b border-hairline shrink-0">
          <div className="flex items-center justify-between mb-3.5">
            <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-xs text-fog no-underline hover:text-paper">
              <ArrowLeft size={13} />
              All workflows
            </Link>
            <div className="flex gap-2">
              <button
                className="text-sm text-fog hover:text-paper inline-flex items-center gap-1.5 px-2 py-1"
                onClick={() => downloadWorkflow(workflow)}
              >
                <Download size={14} />
                Export
              </button>
              {confirmDelete ? (
                <button
                  className="text-sm text-ember hover:bg-ember-dim px-3 py-1 rounded-md"
                  onClick={() => {
                    removeWorkflow(workflow.name);
                    router.push("/");
                  }}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  className="text-sm text-fog hover:text-paper inline-flex items-center gap-1.5 px-2 py-1"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          </div>

          <input
            className="bg-transparent border-none font-display text-[1.9rem] text-paper w-full p-0 border-b border-transparent hover:border-hairline-strong focus:border-hairline-strong outline-none"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <textarea
            className="bg-transparent border-none text-fog text-sm w-full mt-1 p-0 resize-none border-b border-transparent hover:border-hairline-strong focus:border-hairline-strong outline-none"
            value={workflow.description}
            placeholder="What does this workflow do?"
            rows={1}
            onChange={(e) => updateWorkflow(workflow.name, { description: e.target.value })}
          />

          <ParamsEditor params={workflow.parameters} onChange={(next) => updateWorkflow(workflow.name, { parameters: next })} />

          <div className="flex gap-4 mt-3.5 font-mono text-[0.6875rem] text-fog-dim uppercase tracking-wide">
            <span>{workflow.steps.length} steps</span>
            <span>{workflow.parameters.length} parameters</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pl-4 pr-6 pt-4 pb-8 max-lg:overflow-visible max-lg:flex-none">
          <StepTimeline
            steps={workflow.steps}
            selected={selected}
            statuses={sim.statuses}
            onSelect={handleSelect}
            onRemove={(i) => removeStep(workflow.name, i)}
            onDuplicate={(i) => duplicateStep(workflow.name, i)}
            onMoveUp={(i) => i > 0 && moveStep(workflow.name, i, i - 1)}
            onMoveDown={(i) => i < workflow.steps.length - 1 && moveStep(workflow.name, i, i + 1)}
          />
          <AddStepMenu onAdd={handleAddStep} />
        </div>
      </div>

      <div className="border-l border-hairline bg-ink-raised flex flex-col min-h-0 max-lg:border-l-0 max-lg:border-t max-lg:min-h-[420px]">
        <div className="flex border-b border-hairline shrink-0">
          {(["run", "inspect"] as const).map((t) => (
            <button
              key={t}
              className={`flex-1 py-3.5 bg-transparent border-none border-b-2 font-mono text-xs uppercase tracking-widest ${
                tab === t ? "text-paper border-b-amber" : "text-fog border-b-transparent"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "inspect" ? "Inspect" : "Run"}
            </button>
          ))}
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col ${tab === "inspect" ? "" : "hidden"}`}>
          {selectedStep ? (
            <StepInspector
              step={selectedStep}
              index={selected!}
              total={workflow.steps.length}
              onChange={(patch) => updateStep(workflow.name, selected!, patch)}
            />
          ) : (
            <p className="px-6 py-10 text-fog-dim text-sm text-center">
              Select a step to inspect and edit it, or add a new one below.
            </p>
          )}
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col ${tab === "run" ? "" : "hidden"}`}>
          <RunPanel
            workflow={workflow}
            running={sim.running}
            missing={sim.missing}
            lines={sim.lines}
            onStart={sim.start}
            onStop={sim.stop}
          />
        </div>
      </div>
    </div>
  );
}
