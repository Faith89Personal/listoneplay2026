import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  reserved_at: string;
  duration_minutes: number;
  stand: string | null;
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
      SELECT id, name, reserved_at, duration_minutes, stand, note
      FROM manual_events
      WHERE email = ${session.email}
      ORDER BY reserved_at ASC
    `) as Row[];
    return NextResponse.json({
      events: rows.map((r) => ({
        id: r.id,
        name: r.name,
        reservedAt: r.reserved_at,
        durationMinutes: r.duration_minutes,
        stand: r.stand,
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

type PostBody = {
  id?: unknown;
  name?: unknown;
  reservedAt?: unknown;
  durationMinutes?: unknown;
  stand?: unknown;
  note?: unknown;
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
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (typeof body.reservedAt !== "string" || body.reservedAt.length === 0) {
    return NextResponse.json({ error: "invalid_reserved_at" }, { status: 400 });
  }
  const parsed = new Date(body.reservedAt);
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "invalid_reserved_at" }, { status: 400 });
  }
  const duration =
    typeof body.durationMinutes === "number" &&
    body.durationMinutes >= 5 &&
    body.durationMinutes <= 720
      ? Math.round(body.durationMinutes)
      : 60;
  const stand =
    typeof body.stand === "string" && body.stand.length > 0
      ? body.stand.trim().slice(0, 40)
      : null;
  const note =
    typeof body.note === "string" && body.note.length > 0
      ? body.note.trim().slice(0, 500)
      : null;
  const id = typeof body.id === "number" && body.id > 0 ? body.id : null;

  try {
    const sql = requireSql();
    if (id !== null) {
      const updated = (await sql`
        UPDATE manual_events SET
          name = ${name},
          reserved_at = ${parsed.toISOString()},
          duration_minutes = ${duration},
          stand = ${stand},
          note = ${note},
          updated_at = NOW()
        WHERE id = ${id} AND email = ${session.email}
        RETURNING id
      `) as { id: number }[];
      if (updated.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, id: updated[0].id });
    }
    const inserted = (await sql`
      INSERT INTO manual_events (email, name, reserved_at, duration_minutes, stand, note)
      VALUES (${session.email}, ${name}, ${parsed.toISOString()}, ${duration}, ${stand}, ${note})
      RETURNING id
    `) as { id: number }[];
    return NextResponse.json({ ok: true, id: inserted[0].id });
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
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`DELETE FROM manual_events WHERE id = ${id} AND email = ${session.email}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
