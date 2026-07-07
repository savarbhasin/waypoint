"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { makeWorkflow } from "@/types/workflow";
import type { Workflow } from "@/types/workflow";

export function ImportButton({ onError }: { onError: (msg: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const importWorkflow = useWorkflowStore((s) => s.importWorkflow);

  async function handleFile(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      const base = makeWorkflow(raw.name || file.name.replace(/\.json$/i, ""));
      const wf: Workflow = {
        ...base,
        ...raw,
        steps: Array.isArray(raw.steps)
          ? raw.steps.map((s: Partial<Workflow["steps"][number]>) => ({
              instruction: "",
              sleep_before: 0,
              duration: 0,
              skip_command: false,
              max_retries: 3,
              ...s,
            }))
          : [],
      };
      importWorkflow(wf);
    } catch (err) {
      onError(err instanceof Error ? `Couldn't import: ${err.message}` : "Couldn't import that file.");
    }
  }

  return (
    <>
      <button
        className="text-sm font-medium px-4 py-2 border border-hairline-strong rounded-md text-paper hover:border-fog inline-flex items-center gap-1.5"
        onClick={() => ref.current?.click()}
      >
        <Upload size={14} />
        Import
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
