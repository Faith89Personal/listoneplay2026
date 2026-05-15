import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireSql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRow = {
  email: string;
  item_id: number;
  reserved_at: string;
  duration_minutes: number;
  note: string | null;
  share_token: string | null;
  max_seats: number | null;
  shared_with: string[] | null;
  guests: string[] | null;
};

function rowToJson(r: ReservationRow, currentEmail: string) {
  return {
    itemId: r.item_id,
    reservedAt: r.reserved_at,
    durationMinutes: r.duration_minutes,
    note: r.note,
    shareToken: r.share_token,
    maxSeats: r.max_seats,
    sharedWith: r.shared_with ?? [],
    guests: r.guests ?? [],
    ownerEmail: r.email,
    isOwner: r.email === currentEmail,
  };
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scopeAll =
    new URL(req.url).searchParams.get("scope") === "all";
  try {
    const sql = requireSql();
    const rows = (scopeAll
      ? await sql`
          SELECT email, item_id, reserved_at, duration_minutes, note,
                 share_token, max_seats, shared_with, guests
          FROM reservations
          ORDER BY reserved_at ASC
        `
      : await sql`
          SELECT email, item_id, reserved_at, duration_minutes, note,
                 share_token, max_seats, shared_with, guests
          FROM reservations
          WHERE email = ${session.email}
             OR ${session.email} = ANY(shared_with)
          ORDER BY reserved_at ASC
        `) as ReservationRow[];

    const emails = new Set<string>();
    for (const r of rows) {
      emails.add(r.email);
      for (const e of r.shared_with ?? []) emails.add(e);
    }
    const participantNames: Record<string, string> = {};
    if (emails.size > 0) {
      const nameRows = (await sql`
        SELECT email, name FROM users WHERE email = ANY(${[...emails]})
      `) as { email: string; name: string | null }[];
      for (const u of nameRows) {
        if (u.name && u.name.trim().length > 0) participantNames[u.email] = u.name;
      }
    }

    return NextResponse.json({
      reservations: rows.map((r) => rowToJson(r, session.email)),
      participantNames,
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
  durationMinutes?: unknown;
  note?: unknown;
  maxSeats?: unknown;
  guests?: unknown;
  sharedWith?: unknown;
};

function newShareToken(): string {
  return randomBytes(6).toString("hex");
}

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
  const note =
    typeof body.note === "string" && body.note.length > 0
      ? body.note.slice(0, 500)
      : null;
  const maxSeats =
    typeof body.maxSeats === "number" &&
    body.maxSeats >= 2 &&
    body.maxSeats <= 20
      ? Math.round(body.maxSeats)
      : null;
  const guests = Array.isArray(body.guests)
    ? (body.guests as unknown[])
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.trim().slice(0, 80))
        .filter((g) => g.length > 0)
        .slice(0, 20)
    : [];
  const sharedWithFromBody = Array.isArray(body.sharedWith)
    ? (body.sharedWith as unknown[])
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && s !== session.email)
        .slice(0, 20)
    : null;
  const candidateToken = newShareToken();
  try {
    const sql = requireSql();

    if (maxSeats !== null) {
      let effective: string[];
      if (sharedWithFromBody !== null) {
        effective = sharedWithFromBody;
      } else {
        const existRows = (await sql`
          SELECT shared_with FROM reservations
          WHERE email = ${session.email} AND item_id = ${itemId}
          LIMIT 1
        `) as { shared_with: string[] | null }[];
        effective = existRows[0]?.shared_with ?? [];
      }
      const occupancy = 1 + effective.length + guests.length;
      if (occupancy > maxSeats) {
        return NextResponse.json(
          { error: "exceeds_max_seats", occupancy, maxSeats },
          { status: 400 },
        );
      }
    }

    const initialSharedWith = sharedWithFromBody ?? [];
    const rows = (await sql`
      INSERT INTO reservations
        (email, item_id, reserved_at, duration_minutes, note, max_seats,
         share_token, guests, shared_with, updated_at)
      VALUES
        (${session.email}, ${itemId}, ${parsed.toISOString()}, ${duration},
         ${note}, ${maxSeats}, ${candidateToken}, ${guests},
         ${initialSharedWith}, NOW())
      ON CONFLICT (email, item_id)
      DO UPDATE SET reserved_at = EXCLUDED.reserved_at,
                    duration_minutes = EXCLUDED.duration_minutes,
                    note = EXCLUDED.note,
                    max_seats = EXCLUDED.max_seats,
                    guests = EXCLUDED.guests,
                    shared_with = CASE
                      WHEN ${sharedWithFromBody !== null} THEN EXCLUDED.shared_with
                      ELSE reservations.shared_with
                    END,
                    share_token = COALESCE(reservations.share_token,
                                           EXCLUDED.share_token),
                    updated_at = NOW()
      RETURNING share_token
    `) as { share_token: string }[];
    return NextResponse.json({
      ok: true,
      shareToken: rows[0]?.share_token ?? null,
    });
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
