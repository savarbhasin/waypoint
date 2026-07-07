"use client";

import { useEffect, useState } from "react";
import type { CodeRef } from "@/lib/codeRefs";
import { parseLineRange } from "@/lib/parseLineRange";

export function SourceSnippetClient({ ref: codeRef }: { ref: CodeRef }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const anchorId = `source-${codeRef.file.replace(/\//g, "-")}`;
  const range = parseLineRange(codeRef.lines);

  useEffect(() => {
    if (!range) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({
      file: codeRef.file,
      start: String(range.start),
      end: String(range.end),
    });
    fetch(`/api/source?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSnippet(data?.snippet ?? null))
      .catch(() => setSnippet(null))
      .finally(() => setLoading(false));
  }, [codeRef.file, codeRef.lines, range]);

  return (
    <div id={anchorId} className="border border-hairline rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-panel-raised border-b border-hairline">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-amber">{codeRef.file}</span>
          <span className="font-mono text-[0.6875rem] text-fog-dim">:{codeRef.lines}</span>
        </div>
        <span className="font-mono text-[0.6875rem] text-signal">{codeRef.symbol}</span>
      </div>
      <p className="px-3 py-2 text-xs text-fog border-b border-hairline">{codeRef.summary}</p>
      {loading ? (
        <p className="px-3 py-3 text-xs text-fog-dim italic">Loading source…</p>
      ) : snippet ? (
        <pre className="px-3 py-3 text-[0.6875rem] leading-relaxed font-mono text-paper-dim overflow-x-auto bg-ink-raised">
          <code>{snippet}</code>
        </pre>
      ) : (
        <p className="px-3 py-3 text-xs text-fog-dim italic">Source file not found at {codeRef.file}</p>
      )}
    </div>
  );
}
