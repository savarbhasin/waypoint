"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function LiveView({ frame, running }: { frame: string | null; running: boolean }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    if (!frame) setExpanded(false);
  }, [frame]);

  if (!frame && !running) return null;

  return (
    <div className="px-5 pt-5 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog">Live view</span>
        {running && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wide text-ember">
            <span className="w-1.5 h-1.5 rounded-full bg-ember animate-pulse" />
            live
          </span>
        )}
      </div>
      <div
        role={frame ? "button" : undefined}
        tabIndex={frame ? 0 : undefined}
        onClick={() => frame && setExpanded(true)}
        className={`relative w-full aspect-8/5 rounded-md border border-hairline-strong bg-ink-raised overflow-hidden flex items-center justify-center ${frame ? "cursor-zoom-in" : ""}`}
      >
        {frame ? (
          <img src={`data:image/jpeg;base64,${frame}`} alt="Live browser view" className="w-full h-full object-contain" />
        ) : (
          <span className="font-mono text-xs text-fog-dim">waiting for browser…</span>
        )}
      </div>

      {expanded && frame && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setExpanded(false)}
        >
          <button
            className="absolute top-5 right-5 text-paper bg-transparent border border-hairline-strong rounded-md p-2 hover:bg-hairline"
            onClick={() => setExpanded(false)}
            aria-label="Close live view"
          >
            <X size={18} />
          </button>
          <img
            src={`data:image/jpeg;base64,${frame}`}
            alt="Live browser view (expanded)"
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
