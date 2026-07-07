import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __waypointDbPool: Pool | undefined;
}

function createPool() {
  const url =
    process.env.DATABASE_URL ?? "postgresql://waypoint:waypoint@localhost:5432/waypoint";
  return new Pool({ connectionString: url });
}

const pool = globalThis.__waypointDbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__waypointDbPool = pool;
}

export const db = drizzle(pool, { schema });
