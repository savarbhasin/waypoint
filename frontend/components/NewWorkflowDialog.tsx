"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "./Dialog";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export function NewWorkflowDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const workflows = useWorkflowStore((s) => s.workflows);
  const addWorkflow = useWorkflowStore((s) => s.addWorkflow);
  const router = useRouter();

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const taken = workflows.some((w) => w.name === slug);

  async function submit() {
    if (!slug || taken || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const wf = await addWorkflow({
        name: slug,
        description: description.trim(),
        parameters: [],
        steps: [],
      });
      onClose();
      router.push(`/w/${encodeURIComponent(wf.id)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create workflow");
      setSubmitting(false);
    }
  }

  return (
    <Dialog title="New workflow" onClose={onClose}>
      <div className="flex flex-col gap-1.5 mb-4">
        <label className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog" htmlFor="wf-name">
          Name
        </label>
        <input
          id="wf-name"
          className="bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm font-mono text-paper w-full focus:border-signal"
          placeholder="checkout_flow"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <span className="text-[0.6875rem] text-fog-dim">
          {slug ? (taken ? `"${slug}" already exists` : `Saved as ${slug}`) : "Used as the workflow's file-safe identifier"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 mb-4">
        <label className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog" htmlFor="wf-desc">
          Description
        </label>
        <textarea
          id="wf-desc"
          className="bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm text-paper w-full min-h-[4.5rem] resize-y focus:border-signal"
          placeholder="What does this workflow do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {submitError && <p className="text-sm text-ember mb-2">{submitError}</p>}
      <div className="flex justify-end gap-2.5 mt-5">
        <button className="text-sm text-fog hover:text-paper px-4 py-2" onClick={onClose}>
          Cancel
        </button>
        <button
          className="text-sm font-medium px-4 py-2 bg-amber border border-amber text-[#1a1206] rounded-md hover:bg-[#f0ac4c] disabled:opacity-40"
          disabled={!slug || taken || submitting}
          onClick={submit}
        >
          {submitting ? "Creating…" : "Create workflow"}
        </button>
      </div>
    </Dialog>
  );
}
