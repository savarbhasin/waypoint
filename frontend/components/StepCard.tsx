import clsx from "clsx";
import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import type { WorkflowStep } from "@/types/workflow";
import { STEP_TYPE_LABELS } from "@/types/workflow";

function detailLine(step: WorkflowStep): string {
  switch (step.type) {
    case "navigate":
      return step.url || "(no url set)";
    case "click":
      return step.command || "(no locator set)";
    case "fill":
      return `${step.command || "(no locator)"}  ->  "${step.value ?? ""}"`;
    case "select":
      return `${step.command || "(no locator)"}  ->  "${step.value ?? ""}"`;
    case "scroll":
      return `x:${step.scroll_x ?? 0} y:${step.scroll_y ?? 0}`;
    case "ai":
      return step.task || "(no task set)";
    case "extract":
      return `method: ${step.method ?? "screenshot"}`;
    case "wait":
      return `${step.duration}s`;
  }
}

export function StepCard({
  step,
  index,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  step: WorkflowStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={clsx(
        "group flex gap-3.5 px-4 py-3.5 border rounded-md bg-panel cursor-pointer transition-all text-left w-full",
        selected ? "border-signal bg-panel-raised" : "border-hairline hover:bg-panel-raised"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <span className="font-mono text-xs text-fog-dim pt-0.5 w-6 shrink-0">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={clsx(
              "font-mono text-[0.6875rem] uppercase tracking-wide px-1.5 py-0.5 rounded-sm border",
              step.type === "ai"
                ? "text-amber border-amber-dim"
                : step.type === "extract"
                  ? "text-signal border-signal-dim"
                  : "text-fog border-hairline-strong"
            )}
          >
            {STEP_TYPE_LABELS[step.type]}
          </span>
          {step.skip_command && (
            <span className="font-mono text-[0.6875rem] text-amber border border-amber-dim rounded-sm px-1.5 py-0.5">
              always healed
            </span>
          )}
          <span className="text-sm text-paper-dim truncate">{step.instruction || "No instruction yet"}</span>
        </div>
        <div className="font-mono text-[0.6875rem] text-fog-dim truncate">{detailLine(step)}</div>
      </div>
      <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button className="bg-transparent border-none text-fog p-0.5 rounded-sm hover:text-paper hover:bg-hairline flex" onClick={onMoveUp} aria-label="Move step up">
          <ChevronUp size={14} />
        </button>
        <button className="bg-transparent border-none text-fog p-0.5 rounded-sm hover:text-paper hover:bg-hairline flex" onClick={onMoveDown} aria-label="Move step down">
          <ChevronDown size={14} />
        </button>
        <button className="bg-transparent border-none text-fog p-0.5 rounded-sm hover:text-paper hover:bg-hairline flex" onClick={onDuplicate} aria-label="Duplicate step">
          <Copy size={13} />
        </button>
        <button className="bg-transparent border-none text-fog p-0.5 rounded-sm hover:text-paper hover:bg-hairline flex" onClick={onRemove} aria-label="Delete step">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
