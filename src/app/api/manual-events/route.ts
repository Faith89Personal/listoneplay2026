import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
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
  share_token: string | null;
  max_seats: number | null;
  shared_with: string[] | null;
  guests: string[] | null;
};

function newShareToken(): string {
  return randomBytes(6).toString("hex");
}

function rowToJson(r: Row, currentEmail: string) {
  return {
    id: r.id,
    name: r.name,
    reservedAt: r.reserved_at,
    durationMinutes: r.duration_minutes,
    stand: r.stand,
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
          SELECT id, email, name, reserved_at, duration_minutes, stand, note,
                 share_token, max_seats, shared_with, guests
          FROM manual_events
          ORDER BY reserved_at ASC
        `
      : await sql`
          SELECT id, email, name, reserved_at, duration_minutes, stand, note,
                 share_token, max_seats, shared_with, guests
          FROM manual_events
          WHERE email = ${session.email}
             OR ${session.email} = ANY(shared_with)
          ORDER BY reserved_at ASC
        `) as Row[];

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
      events: rows.map((r) => rowToJson(r, session.email)),
      participantNames,
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
  maxSeats?: unknown;
  guests?: unknown;
  sharedWith?: unknown;
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
  const maxSeats =
    typeof body.maxSeats === "number" &&
    body.maxSeats >= 1 &&
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
  const id = typeof body.id === "number" && body.id > 0 ? body.id : null;

  try {
    const sql = requireSql();

    if (maxSeats !== null) {
      let effective: string[];
      if (sharedWithFromBody !== null) {
        effective = sharedWithFromBody;
      } else if (id !== null) {
        const existRows = (await sql`
          SELECT shared_with FROM manual_events
          WHERE id = ${id} AND email = ${session.email}
          LIMIT 1
        `) as { shared_with: string[] | null }[];
        effective = existRows[0]?.shared_with ?? [];
      } else {
        effective = [];
      }
      const occupancy = 1 + effective.length + guests.length;
      if (occupancy > maxSeats) {
        return NextResponse.json(
          { error: "exceeds_max_seats", occupancy, maxSeats },
          { status: 400 },
        );
      }
    }

    if (id !== null) {
      const updated = (await sql`
        UPDATE manual_events SET
          name = ${name},
          reserved_at = ${parsed.toISOString()},
          duration_minutes = ${duration},
          stand = ${stand},
          note = ${note},
          max_seats = ${maxSeats},
          guests = ${guests},
          shared_with = CASE
            WHEN ${sharedWithFromBody !== null} THEN ${sharedWithFromBody ?? []}
            ELSE shared_with
          END,
          updated_at = NOW()
        WHERE id = ${id} AND email = ${session.email}
        RETURNING id, share_token
      `) as { id: number; share_token: string | null }[];
      if (updated.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        id: updated[0].id,
        shareToken: updated[0].share_token,
      });
    }
    const token = newShareToken();
    const inserted = (await sql`
      INSERT INTO manual_events
        (email, name, reserved_at, duration_minutes, stand, note,
         max_seats, share_token, guests)
      VALUES
        (${session.email}, ${name}, ${parsed.toISOString()}, ${duration},
         ${stand}, ${note}, ${maxSeats}, ${token}, ${guests})
      RETURNING id, share_token
    `) as { id: number; share_token: string }[];
    return NextResponse.json({
      ok: true,
      id: inserted[0].id,
      shareToken: inserted[0].share_token,
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
