import { ARCHITECTURE_FILES } from "@/lib/codeRefs";
import { SourceSnippetClient } from "./SourceSnippetClient";

export function ArchitecturePanel() {
  return (
    <div className="px-5 pt-5 pb-10 flex flex-col gap-4">
      <div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-fog mb-2">Pipeline source map</p>
        <p className="text-sm text-fog leading-relaxed">
          Every field in this UI mirrors <code className="font-mono text-amber text-xs">src/models.py</code>. Each step type
          routes through the function shown below when you run{" "}
          <code className="font-mono text-amber text-xs">python src/main.py run</code>.
        </p>
      </div>
      {ARCHITECTURE_FILES.map((ref) => (
        <SourceSnippetClient key={ref.file + ref.symbol} ref={ref} />
      ))}
    </div>
  );
}
