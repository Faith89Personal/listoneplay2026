import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import {
  isValidEmail,
  normalizeEmail,
  setSessionCookie,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body as { email?: unknown })?.email;
  if (!isValidEmail(raw)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = normalizeEmail(raw);

  try {
    const sql = requireSql();
    await sql`INSERT INTO users (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }

  await setSessionCookie(email);
  return NextResponse.json({ email });
}
