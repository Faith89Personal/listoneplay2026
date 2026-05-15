import { NextResponse } from "next/server";
import { requireSql, sql as sqlOrNull } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ email: null, name: null });
  }
  if (!sqlOrNull) {
    return NextResponse.json({ email: session.email, name: null });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT name FROM users WHERE email = ${session.email} LIMIT 1
    `) as { name: string | null }[];
    return NextResponse.json({
      email: session.email,
      name: rows[0]?.name ?? null,
    });
  } catch {
    return NextResponse.json({ email: session.email, name: null });
  }
}
