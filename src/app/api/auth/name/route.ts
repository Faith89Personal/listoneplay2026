import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body as { name?: unknown })?.name;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  const trimmed = raw.trim().slice(0, 80);
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      INSERT INTO users (email, name) VALUES (${session.email}, ${trimmed})
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `;
    return NextResponse.json({ ok: true, name: trimmed });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
