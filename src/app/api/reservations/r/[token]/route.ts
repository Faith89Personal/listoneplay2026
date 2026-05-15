import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";
import itemsSnapshot from "@/data/items.json";
import editorsSnapshot from "@/data/editors.json";
import editorAliases from "@/data/bgg-aliases.json";
import editorAliasesEditor from "@/data/editor-aliases.json";
import type { Item } from "@/types";

void editorAliases;
void editorAliasesEditor;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRow = {
  email: string;
  item_id: number;
  reserved_at: string;
  duration_minutes: number;
  note: string | null;
  share_token: string;
  max_seats: number | null;
  shared_with: string[] | null;
  guests: string[] | null;
};

function lookupItem(itemId: number): {
  name: string;
  editor: string;
  stand: string | null;
} {
  if (itemId >= 0) {
    const items = itemsSnapshot as Item[];
    const it = items.find((x) => x.id === itemId);
    if (it) {
      const editors = (editorsSnapshot as { editors?: Record<string, { stands?: string[] }> }).editors ?? {};
      const stands = editors[it.editor.name]?.stands ?? [];
      return {
        name: it.name,
        editor: it.editor.name,
        stand: stands.length > 0 ? stands.join("·") : null,
      };
    }
  }
  return { name: `#${itemId}`, editor: "", stand: null };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length < 6) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT email, item_id, reserved_at, duration_minutes, note,
             share_token, max_seats, shared_with, guests
      FROM reservations
      WHERE share_token = ${token}
      LIMIT 1
    `) as ReservationRow[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const r = rows[0];
    const session = await getSessionFromCookies();
    const sharedWith = r.shared_with ?? [];
    const guests = r.guests ?? [];
    const isOwner = session?.email === r.email;
    const isJoined = !!session?.email && sharedWith.includes(session.email);
    const occupied = 1 + sharedWith.length + guests.length;
    const isFull =
      typeof r.max_seats === "number" && occupied >= r.max_seats;
    const info = lookupItem(r.item_id);
    const exposeEmails = isOwner || isJoined;
    return NextResponse.json({
      reservation: {
        itemId: r.item_id,
        itemName: info.name,
        editor: info.editor,
        stand: info.stand,
        reservedAt: r.reserved_at,
        durationMinutes: r.duration_minutes,
        note: r.note,
        maxSeats: r.max_seats,
        occupied,
        isFull,
        ownerEmail: exposeEmails ? r.email : null,
        sharedWith: exposeEmails ? sharedWith : [],
        guests,
      },
      viewer: {
        loggedIn: !!session?.email,
        email: session?.email ?? null,
        isOwner,
        isJoined,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!token || token.length < 6) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    const rows = (await sql`
      SELECT email, item_id, max_seats, shared_with, guests
      FROM reservations WHERE share_token = ${token} LIMIT 1
    `) as {
      email: string;
      item_id: number;
      max_seats: number | null;
      shared_with: string[] | null;
      guests: string[] | null;
    }[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const row = rows[0];
    if (row.email === session.email) {
      return NextResponse.json({ error: "is_owner" }, { status: 400 });
    }
    const sharedWith = row.shared_with ?? [];
    const guests = row.guests ?? [];
    if (sharedWith.includes(session.email)) {
      return NextResponse.json({ ok: true, already: true });
    }
    const occupiedAfter = 1 + sharedWith.length + guests.length + 1;
    if (typeof row.max_seats === "number" && occupiedAfter > row.max_seats) {
      return NextResponse.json({ error: "full" }, { status: 409 });
    }
    await sql`
      INSERT INTO users (email) VALUES (${session.email})
      ON CONFLICT (email) DO NOTHING
    `;
    await sql`
      UPDATE reservations
      SET shared_with = array_append(COALESCE(shared_with, '{}'), ${session.email}),
          updated_at = NOW()
      WHERE share_token = ${token}
    `;

    try {
      const joinerRows = (await sql`
        SELECT name FROM users WHERE email = ${session.email} LIMIT 1
      `) as { name: string | null }[];
      const joinerName =
        joinerRows[0]?.name || session.email.split("@")[0] || session.email;
      const itemInfo = lookupItem(row.item_id);
      await sendPushToUser(row.email, {
        title: "Si è unito un amico",
        body: `${joinerName} si è unito a ${itemInfo.name}`,
        url: "/prenotazioni",
      });
    } catch (err) {
      console.warn("[reservations/join] push failed:", (err as Error).message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  try {
    const sql = requireSql();
    await sql`
      UPDATE reservations
      SET shared_with = array_remove(COALESCE(shared_with, '{}'), ${session.email}),
          updated_at = NOW()
      WHERE share_token = ${token}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "db_unavailable", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
