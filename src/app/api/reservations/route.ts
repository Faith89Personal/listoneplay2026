import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRow = {
  item_id: number;
  reserved_at: string | null;
  note: string | null;
};

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT item_id, reserved_at, note FROM reservations WHERE email = ${session.email}
    `) as ReservationRow[];
    return NextResponse.json({
      reservations: rows.map((r) => ({
        itemId: r.item_id,
        reservedAt: r.reserved_at,
        note: r.note,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

type UpsertBody = {
  itemId?: unknown;
  reservedAt?: unknown;
  note?: unknown;
};

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const itemId = typeof body.itemId === "number" ? body.itemId : null;
  if (itemId === null) {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }
  const reservedAt =
    typeof body.reservedAt === "string" && body.reservedAt.length > 0
      ? body.reservedAt
      : null;
  const note =
    typeof body.note === "string" && body.note.length > 0 ? body.note : null;
  try {
    const sql = requireSql();
    await sql`
      INSERT INTO reservations (email, item_id, reserved_at, note, updated_at)
      VALUES (${session.email}, ${itemId}, ${reservedAt}, ${note}, NOW())
      ON CONFLICT (email, item_id)
      DO UPDATE SET reserved_at = EXCLUDED.reserved_at, note = EXCLUDED.note, updated_at = NOW()
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
  const itemIdStr = url.searchParams.get("itemId");
  const itemId = itemIdStr ? Number(itemIdStr) : NaN;
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      DELETE FROM reservations WHERE email = ${session.email} AND item_id = ${itemId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
