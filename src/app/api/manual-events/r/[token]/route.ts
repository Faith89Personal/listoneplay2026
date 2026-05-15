import { NextResponse } from "next/server";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  email: string;
  name: string;
  reserved_at: string;
  duration_minutes: number;
  stand: string | null;
  note: string | null;
  share_token: string;
  max_seats: number | null;
  shared_with: string[] | null;
  guests: string[] | null;
};

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
      SELECT id, email, name, reserved_at, duration_minutes, stand, note,
             share_token, max_seats, shared_with, guests
      FROM manual_events
      WHERE share_token = ${token}
      LIMIT 1
    `) as Row[];
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
    const exposeEmails = isOwner || isJoined;
    return NextResponse.json({
      kind: "manual" as const,
      reservation: {
        itemName: r.name,
        editor: "",
        stand: r.stand,
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
      SELECT email, max_seats, shared_with, guests
      FROM manual_events WHERE share_token = ${token} LIMIT 1
    `) as {
      email: string;
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
    await sql`INSERT INTO users (email) VALUES (${session.email}) ON CONFLICT (email) DO NOTHING`;
    await sql`
      UPDATE manual_events
      SET shared_with = array_append(COALESCE(shared_with, '{}'), ${session.email}),
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
      UPDATE manual_events
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
