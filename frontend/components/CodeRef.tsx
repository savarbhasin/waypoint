import clsx from "clsx";
import type { CodeRef } from "@/lib/codeRefs";

export function CodeRefBadge({ ref: codeRef, className }: { ref: CodeRef; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5",
        className
      )}
      title={codeRef.summary}
    >
      <span className="text-amber">{codeRef.file}</span>
      <span className="text-fog-dim">:{codeRef.lines}</span>
    </span>
  );
}

export function CodeRefLink({ ref: codeRef, className }: { ref: CodeRef; className?: string }) {
  return (
    <a
      href={`#source-${codeRef.file.replace(/\//g, "-")}`}
      className={clsx(
        "inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-fog border border-hairline-strong rounded-sm px-1.5 py-0.5 hover:border-signal hover:text-paper transition-colors",
        className
      )}
      title={codeRef.summary}
    >
      <span className="text-amber">{codeRef.file}</span>
      <span className="text-fog-dim">{codeRef.symbol}</span>
    </a>
  );
}
