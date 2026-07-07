import clsx from "clsx";
import type { RunStatus } from "@/types/workflow";

const STATUS_STYLES: Record<RunStatus, string> = {
  pending: "border-fog-dim bg-transparent",
  running: "border-signal bg-signal shadow-[0_0_0_3px_var(--color-signal-dim)] animate-pulse",
  success: "border-moss bg-moss",
  healed: "border-amber bg-amber shadow-[0_0_0_3px_var(--color-amber-dim)]",
  failed: "border-ember bg-ember",
  skipped: "border-fog-dim border-dashed bg-transparent",
};

export function StatusPip({ status }: { status: RunStatus }) {
  return (
    <span
      className={clsx("w-[9px] h-[9px] rounded-full border-[1.4px] shrink-0 transition-all", STATUS_STYLES[status])}
    />
  );
}
