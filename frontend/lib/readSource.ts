import fs from "fs";
import path from "path";
import { parseLineRange } from "./parseLineRange";

export { parseLineRange };

const SRC_ROOT = path.join(process.cwd(), "..", "src");

export function readSourceSnippet(
  file: string,
  startLine: number,
  endLine: number
): string | null {
  try {
    const fullPath = path.join(SRC_ROOT, file.replace(/^src\//, ""));
    if (!fs.existsSync(fullPath)) return null;
    const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
    const slice = lines.slice(startLine - 1, endLine);
    return slice
      .map((line, i) => `${String(startLine + i).padStart(4, " ")}  ${line}`)
      .join("\n");
  } catch {
    return null;
  }
}
