import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLAGS = new Set(["look", "play"]);
const STATES = new Set(["checked", "forbidden"]);

type SelectionRow = { item_id: number; flag: string; state: string };
type SelectionsPayload = Record<string, Partial<Record<string, string>>>;

function rowsToPayload(rows: SelectionRow[]): SelectionsPayload {
  const out: SelectionsPayload = {};
  for (const r of rows) {
    const key = String(r.item_id);
    if (!out[key]) out[key] = {};
    out[key]![r.flag] = r.state;
  }
  return out;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT item_id, flag, state FROM selections WHERE email = ${session.email}
    `) as SelectionRow[];
    return NextResponse.json({ selections: rowsToPayload(rows) });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

type PutBody = {
  upserts?: Array<{ itemId: number; flag: string; state: string }>;
  deletes?: Array<{ itemId: number; flag: string }>;
};

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const upserts = (body.upserts ?? []).filter(
    (u) =>
      typeof u.itemId === "number" &&
      FLAGS.has(u.flag) &&
      STATES.has(u.state),
  );
  const deletes = (body.deletes ?? []).filter(
    (d) => typeof d.itemId === "number" && FLAGS.has(d.flag),
  );

  try {
    const sql = requireSql();
    for (const u of upserts) {
      await sql`
        INSERT INTO selections (email, item_id, flag, state, updated_at)
        VALUES (${session.email}, ${u.itemId}, ${u.flag}, ${u.state}, NOW())
        ON CONFLICT (email, item_id, flag)
        DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
      `;
    }
    for (const d of deletes) {
      await sql`
        DELETE FROM selections
        WHERE email = ${session.email} AND item_id = ${d.itemId} AND flag = ${d.flag}
      `;
    }
    return NextResponse.json({ ok: true, upserts: upserts.length, deletes: deletes.length });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
