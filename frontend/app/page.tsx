"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { WorkflowCard } from "@/components/WorkflowCard";
import { NewWorkflowDialog } from "@/components/NewWorkflowDialog";
import { ImportButton } from "@/components/ImportButton";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export default function HomePage() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen max-w-[1080px] mx-auto px-8 pt-8 pb-20">
      <div className="flex items-center justify-between mb-14">
        <Wordmark />
        <div className="flex gap-2.5">
          <ImportButton onError={setError} />
          <button
            className="text-sm font-medium px-4 py-2 bg-amber border border-amber text-[#1a1206] rounded-md inline-flex items-center gap-1.5 hover:bg-[#f0ac4c]"
            onClick={() => setShowNew(true)}
          >
            <Plus size={14} />
            New workflow
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-ember-dim border border-ember rounded-md text-sm flex justify-between gap-4">
          <span>{error}</span>
          <button className="text-fog hover:text-paper" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-14 pb-12 border-b border-hairline">
        <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fog mb-4">Browser workflow studio</div>
        <h1 className="font-display text-[clamp(2.2rem,4.5vw,4rem)] leading-[1.05] max-w-[15ch] text-paper">
          Record once. <em className="italic text-amber">Replay</em> anywhere.
        </h1>
        <p className="mt-4 max-w-[46ch] text-fog text-[1.0625rem] leading-relaxed">
          Waypoint inspects the workflows your recorder captures — every click, fill and navigation —
          and shows exactly what will happen when the runner replays them, including which steps hand
          off to the AI healer.
        </p>
      </div>

      <div className="flex items-baseline justify-between mb-5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Workflows</span>
        <span className="font-mono text-[0.6875rem] text-fog-dim">{workflows.length} total</span>
      </div>

      {workflows.length === 0 ? (
        <div className="border border-dashed border-hairline-strong rounded-lg py-12 px-8 text-center text-fog">
          No workflows yet. Record one with the CLI, or create one here.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {workflows.map((wf) => (
            <WorkflowCard key={wf.name} workflow={wf} />
          ))}
        </div>
      )}

      {showNew && <NewWorkflowDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
