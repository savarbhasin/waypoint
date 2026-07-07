export function resolveParams(value: string | undefined, params: Record<string, string>): string {
  if (!value) return "";
  let out = value;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

export function extractTokens(value: string | undefined): string[] {
  if (!value) return [];
  const matches = value.matchAll(/\{([a-zA-Z0-9_]+)\}/g);
  return [...matches].map((m) => m[1]);
}

export function missingParams(required: string[], provided: Record<string, string>): string[] {
  return required.filter((p) => !(p in provided) || provided[p].trim() === "");
}
