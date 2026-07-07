import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema/tokens";
import { eq } from "drizzle-orm";

export function generateToken(): { token: string; hash: string } {
  const token = `wp_${randomBytes(32).toString("hex")}`;
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token);
  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).limit(1);
  if (!row) return null;

  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return { userId: row.userId };
}
