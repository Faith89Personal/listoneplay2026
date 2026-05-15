import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string;
  editor: string | null;
  rating: number;
  played_on: string | null;
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
      SELECT id, name, editor, rating, played_on, note
      FROM manual_plays
      WHERE email = ${session.email}
      ORDER BY rating DESC, name ASC
    `) as Row[];
    return NextResponse.json({
      plays: rows.map((r) => ({
        id: r.id,
        name: r.name,
        editor: r.editor,
        rating: r.rating,
        playedOn:
          r.played_on && typeof r.played_on === "string"
            ? r.played_on.slice(0, 10)
            : null,
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
  editor?: unknown;
  rating?: unknown;
  playedOn?: unknown;
  note?: unknown;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const editor =
    typeof body.editor === "string" && body.editor.trim().length > 0
      ? body.editor.trim().slice(0, 200)
      : null;
  const playedOn =
    typeof body.playedOn === "string" && DATE_RE.test(body.playedOn)
      ? body.playedOn
      : null;
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;
  const id = typeof body.id === "number" && body.id > 0 ? body.id : null;
  try {
    const sql = requireSql();
    if (id !== null) {
      const updated = (await sql`
        UPDATE manual_plays SET
          name = ${name},
          editor = ${editor},
          rating = ${rating},
          played_on = ${playedOn},
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
      INSERT INTO manual_plays (email, name, editor, rating, played_on, note)
      VALUES (${session.email}, ${name}, ${editor}, ${rating}, ${playedOn}, ${note})
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
    await sql`DELETE FROM manual_plays WHERE id = ${id} AND email = ${session.email}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
