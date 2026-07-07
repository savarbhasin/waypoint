"use client";

import { X } from "lucide-react";
import type { ExtractMethod, StepType, WorkflowStep } from "@/types/workflow";
import { STEP_TYPE_LABELS } from "@/types/workflow";
import { extractTokens } from "@/lib/params";

const STEP_TYPES: StepType[] = ["navigate", "click", "fill", "select", "scroll", "ai", "extract", "wait"];
const EXTRACT_METHODS: ExtractMethod[] = ["selectors", "code", "screenshot", "html", "llm"];

function TokenHint({ value }: { value?: string }) {
  const tokens = extractTokens(value);
  if (tokens.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tokens.map((t) => (
        <span key={t} className="font-mono text-[0.6875rem] text-signal bg-signal-dim rounded-sm px-1.5 py-0.5">
          {`{${t}}`}
        </span>
      ))}
    </div>
  );
}

const fieldClass = "bg-ink-raised border border-hairline-strong rounded-md px-3 py-2 text-sm text-paper w-full focus:border-signal";
const monoClass = `${fieldClass} font-mono`;
const labelClass = "font-mono text-[0.6875rem] uppercase tracking-widest text-fog";

export function StepInspector({
  step,
  index,
  total,
  onChange,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  onChange: (patch: Partial<WorkflowStep>) => void;
}) {
  const selectors = Object.entries(step.extraction_selectors ?? {});

  function setSelector(oldKey: string, newKey: string, value: string) {
    const next = { ...(step.extraction_selectors ?? {}) };
    if (oldKey !== newKey) delete next[oldKey];
    next[newKey] = value;
    onChange({ extraction_selectors: next });
  }

  function removeSelector(key: string) {
    const next = { ...(step.extraction_selectors ?? {}) };
    delete next[key];
    onChange({ extraction_selectors: next });
  }

  return (
    <div className="px-5 pt-5 pb-10">
      <div className="flex items-center gap-2 mb-5">
        <span className="font-mono text-[0.6875rem] text-fog-dim">
          Step {index + 1} / {total}
        </span>
        <select
          className={`${fieldClass} w-auto ml-auto`}
          value={step.type}
          onChange={(e) => onChange({ type: e.target.value as StepType })}
        >
          {STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {STEP_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <label className={labelClass}>Instruction</label>
        <textarea
          className={`${fieldClass} min-h-[4.5rem] resize-y`}
          value={step.instruction}
          placeholder="What does this step do, in plain language?"
          onChange={(e) => onChange({ instruction: e.target.value })}
        />
      </div>

      {step.type === "navigate" && (
        <div className="flex flex-col gap-1.5 mb-4">
          <label className={labelClass}>URL</label>
          <input className={monoClass} value={step.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://example.com/{path}" />
          <TokenHint value={step.url} />
        </div>
      )}

      {(step.type === "click" || step.type === "fill" || step.type === "select") && (
        <div className="flex flex-col gap-1.5 mb-4">
          <label className={labelClass}>Playwright locator</label>
          <input className={monoClass} value={step.command ?? ""} onChange={(e) => onChange({ command: e.target.value })} placeholder='get_by_role("button", name="Submit")' />
          <span className="text-[0.6875rem] text-fog-dim">Evaluated as page.&lt;this&gt; at run time.</span>
        </div>
      )}

      {(step.type === "fill" || step.type === "select") && (
        <div className="flex flex-col gap-1.5 mb-4">
          <label className={labelClass}>Value</label>
          <input className={monoClass} value={step.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="{param_name} or a literal value" />
          <TokenHint value={step.value} />
        </div>
      )}

      {step.type === "scroll" && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Scroll X</label>
            <input type="number" className={monoClass} value={step.scroll_x ?? 0} onChange={(e) => onChange({ scroll_x: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Scroll Y</label>
            <input type="number" className={monoClass} value={step.scroll_y ?? 0} onChange={(e) => onChange({ scroll_y: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {step.type === "ai" && (
        <div className="flex flex-col gap-1.5 mb-4">
          <label className={labelClass}>Task for the agent</label>
          <textarea className={`${fieldClass} min-h-[4.5rem] resize-y`} value={step.task ?? ""} onChange={(e) => onChange({ task: e.target.value })} placeholder="Describe what the agent should accomplish on this page." />
        </div>
      )}

      {step.type === "wait" && (
        <div className="flex flex-col gap-1.5 mb-4">
          <label className={labelClass}>Duration (seconds)</label>
          <input type="number" step="0.1" min="0" className={monoClass} value={step.duration} onChange={(e) => onChange({ duration: Number(e.target.value) })} />
        </div>
      )}

      {step.type === "extract" && (
        <>
          <div className="flex flex-col gap-1.5 mb-4">
            <label className={labelClass}>Method</label>
            <select className={fieldClass} value={step.method ?? "screenshot"} onChange={(e) => onChange({ method: e.target.value as ExtractMethod })}>
              {EXTRACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {step.method === "selectors" && (
            <div className="flex flex-col gap-1.5 mb-4">
              <label className={labelClass}>Field selectors</label>
              {selectors.map(([key, sel]) => (
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 mb-1.5" key={key}>
                  <input className={monoClass} value={key} placeholder="field_name" onChange={(e) => setSelector(key, e.target.value, sel)} />
                  <input className={monoClass} value={sel} placeholder="CSS selector" onChange={(e) => setSelector(key, key, e.target.value)} />
                  <button className="bg-transparent border border-hairline-strong rounded-sm text-fog flex items-center justify-center hover:text-ember hover:border-ember" onClick={() => removeSelector(key)} aria-label="Remove field">
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button className="font-mono text-[0.6875rem] text-signal bg-transparent border-none text-left py-1" onClick={() => setSelector("", `field_${selectors.length + 1}`, "")}>
                + add field
              </button>
            </div>
          )}
          {step.method === "code" && (
            <div className="flex flex-col gap-1.5 mb-4">
              <label className={labelClass}>Extractor function</label>
              <input className={monoClass} value={step.extractor_fn ?? ""} onChange={(e) => onChange({ extractor_fn: e.target.value })} placeholder="mymodule.my_extractor_fn" />
              <span className="text-[0.6875rem] text-fog-dim">Dotted path; falls back to the LLM on failure.</span>
            </div>
          )}
          {(step.method === "screenshot" || step.method === "html" || step.method === "llm" || step.method === "code") && (
            <>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className={labelClass}>Extraction instruction</label>
                <textarea className={`${fieldClass} min-h-[4.5rem] resize-y`} value={step.extract_instruction ?? ""} onChange={(e) => onChange({ extract_instruction: e.target.value })} placeholder="What should the model read from the page?" />
              </div>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className={labelClass}>Extraction format (JSON)</label>
                <textarea
                  className={`${fieldClass} font-mono min-h-[4.5rem] resize-y`}
                  value={JSON.stringify(step.extraction_format ?? {}, null, 2)}
                  onChange={(e) => {
                    try {
                      onChange({ extraction_format: JSON.parse(e.target.value) });
                    } catch {
                      /* ignore invalid intermediate JSON */
                    }
                  }}
                />
              </div>
            </>
          )}
        </>
      )}

      <hr className="border-hairline my-5" />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Sleep before (s)</label>
          <input type="number" step="0.1" min="0" className={monoClass} value={step.sleep_before} onChange={(e) => onChange({ sleep_before: Number(e.target.value) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Max retries</label>
          <input type="number" min="1" className={monoClass} value={step.max_retries} onChange={(e) => onChange({ max_retries: Number(e.target.value) })} />
        </div>
      </div>

      {["click", "fill", "select", "scroll", "navigate"].includes(step.type) && (
        <label className="flex items-center gap-2 text-sm text-paper-dim mb-5">
          <input type="checkbox" checked={step.skip_command} onChange={(e) => onChange({ skip_command: e.target.checked })} />
          Always hand off to the AI healer, skip the Playwright command
        </label>
      )}
    </div>
  );
}
