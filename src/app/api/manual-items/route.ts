import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORY_IDS = new Set([1, 2, 3]);

type Row = {
  id: number;
  name: string;
  editor: string;
  category_id: number;
  stand: string | null;
  id_bgg: number | null;
};

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT id, name, editor, category_id, stand, id_bgg
      FROM manual_items
      WHERE email = ${session.email}
      ORDER BY id DESC
    `) as Row[];
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        editor: r.editor,
        categoryId: r.category_id,
        stand: r.stand,
        idBgg: r.id_bgg,
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
  categoryId?: unknown;
  stand?: unknown;
  idBgg?: unknown;
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
  const categoryId =
    typeof body.categoryId === "number" && VALID_CATEGORY_IDS.has(body.categoryId)
      ? body.categoryId
      : null;
  if (categoryId === null) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  const editor =
    typeof body.editor === "string" ? body.editor.trim().slice(0, 200) : "";
  const stand =
    typeof body.stand === "string" && body.stand.trim().length > 0
      ? body.stand.trim().slice(0, 40)
      : null;
  const idBgg =
    typeof body.idBgg === "number" && Number.isFinite(body.idBgg)
      ? Math.round(body.idBgg)
      : null;
  const id =
    typeof body.id === "number" && body.id < 0 ? Math.round(body.id) : null;

  try {
    const sql = requireSql();
    if (id !== null) {
      const updated = (await sql`
        UPDATE manual_items SET
          name = ${name},
          editor = ${editor},
          category_id = ${categoryId},
          stand = ${stand},
          id_bgg = ${idBgg},
          updated_at = NOW()
        WHERE email = ${session.email} AND id = ${id}
        RETURNING id
      `) as { id: number }[];
      if (updated.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, id: updated[0].id });
    }

    const nextRows = (await sql`
      SELECT COALESCE(MIN(id), 0) - 1 AS next_id
      FROM manual_items
      WHERE email = ${session.email}
    `) as { next_id: number }[];
    const newId = nextRows[0]?.next_id ?? -1;

    const inserted = (await sql`
      INSERT INTO manual_items (email, id, name, editor, category_id, stand, id_bgg)
      VALUES (${session.email}, ${newId}, ${name}, ${editor}, ${categoryId}, ${stand}, ${idBgg})
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
  if (!Number.isFinite(id) || id >= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`DELETE FROM selections WHERE email = ${session.email} AND item_id = ${id}`;
    await sql`DELETE FROM plays WHERE email = ${session.email} AND item_id = ${id}`;
    await sql`DELETE FROM reservations WHERE email = ${session.email} AND item_id = ${id}`;
    await sql`DELETE FROM manual_items WHERE email = ${session.email} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
