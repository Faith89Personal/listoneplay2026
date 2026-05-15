import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DAYS = new Set(["2026-05-22", "2026-05-23", "2026-05-24"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = { item_id: number; rush_day: string };

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT item_id, rush_day
      FROM rushes
      WHERE email = ${session.email}
      ORDER BY rush_day ASC, item_id ASC
    `) as Row[];
    return NextResponse.json({
      rushes: rows.map((r) => ({
        itemId: r.item_id,
        day:
          typeof r.rush_day === "string"
            ? r.rush_day.slice(0, 10)
            : new Date(r.rush_day).toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

type PostBody = {
  itemId?: unknown;
  day?: unknown;
};

function validateBody(body: PostBody): { itemId: number; day: string } | null {
  const itemId = typeof body.itemId === "number" ? body.itemId : null;
  if (itemId === null) return null;
  if (typeof body.day !== "string" || !DATE_RE.test(body.day)) return null;
  if (!ALLOWED_DAYS.has(body.day)) return null;
  return { itemId, day: body.day };
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const valid = validateBody(body);
  if (!valid) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      INSERT INTO rushes (email, item_id, rush_day)
      VALUES (${session.email}, ${valid.itemId}, ${valid.day})
      ON CONFLICT (email, item_id, rush_day) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const itemId = Number(url.searchParams.get("itemId"));
  const day = url.searchParams.get("day") ?? "";
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }
  if (!DATE_RE.test(day) || !ALLOWED_DAYS.has(day)) {
    return NextResponse.json({ error: "invalid_day" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      DELETE FROM rushes
      WHERE email = ${session.email} AND item_id = ${itemId} AND rush_day = ${day}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
