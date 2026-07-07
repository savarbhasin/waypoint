export function parseLineRange(lines: string): { start: number; end: number } | null {
  const match = lines.match(/(\d+)(?:[–-](\d+))?/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start + 20;
  return { start, end: Math.min(end, start + 40) };
}
