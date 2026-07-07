import OpenAI from "openai";
import type { WorkflowStep } from "@/types/workflow";
import { STEP_DEFAULTS } from "@/types/workflow";

export const ENRICH_SYSTEM_PROMPT = `You are enriching a recorded browser automation workflow JSON.

## Your tasks

1. **description** — Write 1-2 sentences describing what this workflow does.

2. **parameters** — Find hardcoded values in \`fill\` steps (and \`navigate\` URLs with query strings) that a user would supply at runtime. Output a flat list of snake_case parameter names, e.g. \`["username", "search_query"]\`. Never include the recorded value — it is discarded.

3. **value substitution** — For each parameterized step, replace the hardcoded value with \`{param_name}\` (e.g. \`{username}\`).

4. **instruction** — Write a clear natural-language sentence for every step describing WHAT the field or action is, not WHAT value to enter. Never mention or leak the original recorded value. Good: "Enter your username into the login field." Bad: "Enter 'john_doe' into the login field."

5. **skip_command** — Set \`skip_command: true\` on any step where the \`command\` contains a hardcoded dynamic value that will differ every run (e.g. a generated ID, a session token baked into the locator). Do NOT set it for stable role/label-based locators.

6. **Remove duplicate steps** — If consecutive steps perform the same action on the same element (e.g. two clicks on the same locator), keep only the last one. Remove any no-op or redundant intermediate clicks that exist only as focus artifacts.

7. **Remove click-triggered navigations** — If a \`navigate\` step immediately follows a \`click\` step on a link or button, the navigation could be caused by that click and is redundant. Remove it if you feel it was triggered due to click. Keep only navigations that are explicitly user-initiated.

## Output rules

- Return ONLY the complete enriched workflow as valid JSON. No explanation, no markdown fences.
- Omit any field that is null or matches its default value: \`sleep_before: 0\`, \`duration: 0\`, \`skip_command: false\`, \`max_retries: 3\`, \`instruction: ""\`.
- IDs will be reassigned after — you may output any integer IDs, they will be overwritten.

## Workflow JSON schema reference

Step types: navigate, click, fill, select, ai, extract, wait

Fields per step (only include non-null, non-default):
- id (int), type, instruction, command (Playwright locator expression)
- url (navigate steps only), value (fill/select, supports {param_name} substitution)
- task (ai steps only), method/extract_instruction/extraction_format (extract steps only)
- duration (wait steps only), skip_command: true (only when needed), max_retries (only if not 3)

Parameters format:
\`\`\`json
"parameters": ["username", "search_query"]
\`\`\`

Step value substitution:
\`\`\`json
{ "type": "fill", "instruction": "Enter your username.", "command": "...", "value": "{username}" }
\`\`\`
`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stripMarkdownFences(text: string): string {
  return text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
}

function normalizeStep(raw: Partial<WorkflowStep> & { type: WorkflowStep["type"] }): WorkflowStep {
  return {
    type: raw.type,
    instruction: raw.instruction ?? "",
    command: raw.command,
    url: raw.url,
    value: raw.value,
    task: raw.task,
    method: raw.method,
    extraction_selectors: raw.extraction_selectors,
    extractor_fn: raw.extractor_fn,
    extract_instruction: raw.extract_instruction,
    extraction_format: raw.extraction_format,
    scroll_x: raw.scroll_x,
    scroll_y: raw.scroll_y,
    sleep_before: raw.sleep_before ?? STEP_DEFAULTS.sleep_before,
    duration: raw.duration ?? STEP_DEFAULTS.duration,
    skip_command: raw.skip_command ?? STEP_DEFAULTS.skip_command,
    max_retries: raw.max_retries ?? STEP_DEFAULTS.max_retries,
  };
}

export async function enrichWorkflow(
  rawName: string,
  rawSteps: WorkflowStep[],
): Promise<{ name: string; description: string; parameters: string[]; steps: WorkflowStep[] }> {
  const rawJson = JSON.stringify({ name: rawName, steps: rawSteps }, null, 2);

  const response = await client.responses.create({
    model: "gpt-5.2",
    reasoning: { effort: "low" },
    instructions: ENRICH_SYSTEM_PROMPT,
    input: `Enrich this recorded workflow:\n\n${rawJson}`,
  });

  const responseText = stripMarkdownFences(response.output_text.trim());
  const parsed = JSON.parse(responseText) as {
    name?: string;
    description?: string;
    parameters?: string[];
    steps?: Array<Partial<WorkflowStep> & { type: WorkflowStep["type"] }>;
  };

  return {
    name: parsed.name ?? rawName,
    description: parsed.description ?? "",
    parameters: parsed.parameters ?? [],
    steps: (parsed.steps ?? []).map(normalizeStep),
  };
}
