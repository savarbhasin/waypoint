"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { StepType } from "@/types/workflow";
import { STEP_TYPE_LABELS } from "@/types/workflow";

const ORDER: StepType[] = ["navigate", "click", "fill", "select", "scroll", "ai", "extract", "wait"];

export function AddStepMenu({ onAdd }: { onAdd: (type: StepType) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative mt-1" ref={wrapRef}>
      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 bg-panel-raised border border-hairline-strong rounded-md p-1.5 grid grid-cols-2 gap-1 z-10 shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          {ORDER.map((type) => (
            <button
              key={type}
              className="px-2.5 py-2 rounded-sm border-none bg-transparent text-paper-dim text-sm text-left hover:bg-hairline hover:text-paper"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
            >
              {STEP_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}
      <button
        className="w-full py-3 border border-dashed border-hairline-strong rounded-md bg-transparent text-fog font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 hover:border-amber hover:text-amber transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={13} />
        Add step
      </button>
    </div>
  );
}
