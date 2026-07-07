"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function ParamsEditor({ params, onChange }: { params: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const clean = draft.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (clean && !params.includes(clean)) onChange([...params, clean]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center mt-3.5">
      {params.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 font-mono text-xs text-paper-dim bg-panel border border-hairline-strong rounded-full pl-2.5 pr-1 py-1">
          {p}
          <button
            className="bg-transparent border-none text-fog-dim flex p-0.5 rounded-full hover:text-ember hover:bg-ember-dim"
            onClick={() => onChange(params.filter((x) => x !== p))}
            aria-label={`Remove parameter ${p}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className="font-mono text-xs bg-ink-raised border border-signal rounded-full px-2.5 py-1 text-paper w-[140px]"
          value={draft}
          placeholder="param_name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          onBlur={commit}
        />
      ) : (
        <button
          className="font-mono text-xs text-fog bg-transparent border border-dashed border-hairline-strong rounded-full px-2.5 py-1 hover:text-amber hover:border-amber"
          onClick={() => setAdding(true)}
        >
          + parameter
        </button>
      )}
    </div>
  );
}
