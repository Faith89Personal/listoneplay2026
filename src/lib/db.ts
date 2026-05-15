import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  // Allowed during build — we only error at request time.
  console.warn("[db] DATABASE_URL not set");
}

export const sql = url ? neon(url) : null;

export function requireSql() {
  if (!sql) throw new Error("DATABASE_URL not configured");
  return sql;
}
