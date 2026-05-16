import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  item_id: number;
  rating: number;
  note: string | null;
  played_at: string;
  bought: boolean;
};

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT item_id, rating, note, played_at, bought
      FROM plays
      WHERE email = ${session.email}
      ORDER BY played_at DESC
    `) as Row[];
    return NextResponse.json({
      plays: rows.map((r) => ({
        itemId: r.item_id,
        rating: r.rating,
        note: r.note,
        playedAt: r.played_at,
        bought: r.bought,
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
  rating?: unknown;
  note?: unknown;
  bought?: unknown;
};

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
  const itemId = typeof body.itemId === "number" ? body.itemId : null;
  if (itemId === null) {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }
  const rating =
    typeof body.rating === "number" &&
    body.rating >= 1 &&
    body.rating <= 5 &&
    Number.isInteger(body.rating)
      ? body.rating
      : null;
  if (rating === null) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.length > 0
      ? body.note.trim().slice(0, 500)
      : null;
  const bought = body.bought === true;
  try {
    const sql = requireSql();
    await sql`
      INSERT INTO plays (email, item_id, rating, note, bought, played_at, updated_at)
      VALUES (${session.email}, ${itemId}, ${rating}, ${note}, ${bought}, NOW(), NOW())
      ON CONFLICT (email, item_id)
      DO UPDATE SET rating = EXCLUDED.rating,
                    note = EXCLUDED.note,
                    bought = EXCLUDED.bought,
                    updated_at = NOW()
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
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      DELETE FROM plays WHERE email = ${session.email} AND item_id = ${itemId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
