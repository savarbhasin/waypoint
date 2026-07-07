"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import type { Workflow } from "@/types/workflow";
import type { RunLine } from "@/hooks/useRunSimulation";

const TONE_COLORS: Record<string, string> = {
  success: "text-moss",
  healed: "text-amber",
  failed: "text-ember",
  running: "text-signal",
  pending: "text-fog",
};

export function RunPanel({
  workflow,
  running,
  missing,
  lines,
  onStart,
  onStop,
}: {
  workflow: Workflow;
  running: boolean;
  missing: string[];
  lines: RunLine[];
  onStart: (params: Record<string, string>) => void;
  onStop: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 pt-5 pb-2 shrink-0">
        {workflow.parameters.length === 0 ? (
          <p className="text-[0.6875rem] text-fog-dim">This workflow takes no parameters.</p>
        ) : (
          workflow.parameters.map((p) => (
            <div className="flex flex-col gap-1.5 mb-4" key={p}>
              <label className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">{p}</label>
              <input
                className="bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm font-mono text-paper w-full focus:border-signal"
                value={values[p] ?? ""}
                placeholder={`value for {${p}}`}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              />
            </div>
          ))
        )}
        {missing.length > 0 && (
          <div className="bg-ember-dim border border-ember text-paper rounded-md px-3 py-2 text-xs mb-4">
            Missing required: {missing.join(", ")}
          </div>
        )}
      </div>

      <div className="flex gap-2 px-5 pb-4 shrink-0">
        {running ? (
          <button
            className="flex-1 text-sm font-medium px-4 py-2 border border-hairline-strong rounded-md text-paper inline-flex items-center justify-center gap-1.5"
            onClick={onStop}
          >
            <Square size={13} />
            Stop
          </button>
        ) : (
          <button
            className="flex-1 text-sm font-medium px-4 py-2 bg-amber border border-amber text-[#1a1206] rounded-md inline-flex items-center justify-center gap-1.5 hover:bg-[#f0ac4c]"
            onClick={() => onStart(values)}
          >
            <Play size={13} />
            Run preview
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between px-5 py-2.5 border-t border-hairline shrink-0">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Flight log</span>
        <span className="text-[0.6875rem] text-fog-dim">dry run</span>
      </div>
      <div ref={consoleRef} className="flex-1 min-h-[160px] overflow-y-auto px-5 pb-5 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-fog-dim text-xs">Nothing yet — run a preview to see the replay decision for every step.</p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-words ${TONE_COLORS[l.tone] ?? "text-fog"}`}>
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
