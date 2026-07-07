import clsx from "clsx";
import type { RunStatus, WorkflowStep } from "@/types/workflow";
import { StepCard } from "./StepCard";
import { StatusPip } from "./StatusPip";

function TimelineDot({ status, selected }: { status: RunStatus; selected: boolean }) {
  if (selected) {
    return (
      <span className="w-[11px] h-[11px] rounded-full border-[1.4px] border-paper bg-paper scale-110 transition-all" />
    );
  }
  return <StatusPip status={status} />;
}

export function StepTimeline({
  steps,
  selected,
  statuses,
  onSelect,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  steps: WorkflowStep[];
  selected: number | null;
  statuses: RunStatus[];
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
  onDuplicate: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const last = steps.length - 1;

  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} id={`step-${i}`} className="flex items-stretch gap-3">
          <div className="flex w-7 shrink-0 flex-col items-center">
            {i > 0 && <div className="w-px flex-1 bg-hairline-strong" />}
            <button
              type="button"
              className={clsx(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink transition-colors",
                selected === i ? "ring-1 ring-signal ring-offset-2 ring-offset-ink" : "hover:bg-panel"
              )}
              onClick={() => onSelect(i)}
              aria-label={`Step ${i + 1}`}
              title={`Step ${i + 1}`}
            >
              <TimelineDot status={statuses[i] ?? "pending"} selected={selected === i} />
            </button>
            {i < last && <div className="w-px flex-1 bg-hairline-strong" />}
          </div>

          <div className="min-w-0 flex-1 py-1">
            <StepCard
              step={step}
              index={i}
              selected={selected === i}
              onSelect={() => onSelect(i)}
              onRemove={() => onRemove(i)}
              onDuplicate={() => onDuplicate(i)}
              onMoveUp={() => onMoveUp(i)}
              onMoveDown={() => onMoveDown(i)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
