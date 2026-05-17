import { NextResponse } from "next/server";
import { requireSql, sql as sqlOrNull } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rawEmail = (body as { email?: unknown })?.email;
  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);

  if (!sqlOrNull) {
    return NextResponse.json({ hasName: false });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT name FROM users WHERE email = ${email} LIMIT 1
    `) as { name: string | null }[];
    const name = rows[0]?.name ?? null;
    return NextResponse.json({
      hasName: typeof name === "string" && name.trim().length > 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
