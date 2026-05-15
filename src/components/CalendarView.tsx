"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useItems } from "@/lib/useItems";
import { useReservations, type Reservation } from "@/lib/useReservations";
import { useSession } from "@/lib/useSession";
import {
  EVENT_CLOSE_HOUR,
  EVENT_DAYS,
  EVENT_OPEN_HOUR,
  utcIsoToRomeParts,
} from "@/lib/eventDays";
import ReservationModal from "@/components/ReservationModal";
import type { Item } from "@/types";

const HOURS: number[] = Array.from(
  { length: EVENT_CLOSE_HOUR - EVENT_OPEN_HOUR + 1 },
  (_, i) => EVENT_OPEN_HOUR + i,
);
const PX_PER_MIN = 1.5; // 90px per hour

type DayBlock = {
  reservation: Reservation;
  item: Item | null;
  topPx: number;
  heightPx: number;
  startTime: string;
  endTime: string;
  overlapping: boolean;
};

function buildDayBlocks(
  reservations: Reservation[],
  itemsById: Map<number, Item>,
): Map<string, DayBlock[]> {
  const blocks = new Map<string, DayBlock[]>();
  for (const eventDay of EVENT_DAYS) blocks.set(eventDay.date, []);
  for (const r of reservations) {
    const p = utcIsoToRomeParts(r.reservedAt);
    const list = blocks.get(p.date);
    if (!list) continue;
    const minutesFromOpen = (p.hour - EVENT_OPEN_HOUR) * 60 + p.minute;
    const topPx = Math.max(0, minutesFromOpen) * PX_PER_MIN;
    const heightPx = r.durationMinutes * PX_PER_MIN;
    const endMs =
      new Date(r.reservedAt).getTime() + r.durationMinutes * 60_000;
    const endParts = utcIsoToRomeParts(new Date(endMs).toISOString());
    list.push({
      reservation: r,
      item: itemsById.get(r.itemId) ?? null,
      topPx,
      heightPx,
      startTime: p.time,
      endTime: endParts.time,
      overlapping: false,
    });
  }
  for (const list of blocks.values()) {
    list.sort((a, b) => a.topPx - b.topPx);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.topPx < a.topPx + a.heightPx) {
          a.overlapping = true;
          b.overlapping = true;
        } else {
          break;
        }
      }
    }
  }
  return blocks;
}

export default function CalendarView() {
  const session = useSession();
  const { data } = useItems();
  const reservationsState = useReservations();
  const [editing, setEditing] = useState<Item | null>(null);

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    return m;
  }, [data]);

  const blocksByDay = useMemo(
    () => buildDayBlocks(reservationsState.reservations, itemsById),
    [reservationsState.reservations, itemsById],
  );

  if (session.loading || reservationsState.sessionLoading) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-10 text-center text-sm text-neutral-500">
        Carico…
      </div>
    );
  }
  if (!session.email) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-10 text-center">
        <p className="text-sm text-neutral-700">
          Devi essere connesso per vedere le tue prenotazioni.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block rounded bg-brand px-4 py-2 text-sm font-medium text-white shadow"
        >
          Torna alla lista
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-brand text-white shadow">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Link
            href="/"
            aria-label="Torna alla lista"
            className="rounded p-1.5 active:bg-white/15"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="20" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-base font-bold">Le mie prenotazioni</span>
            <span className="text-[11px] opacity-80">
              {reservationsState.reservations.length} prenotazion
              {reservationsState.reservations.length === 1 ? "e" : "i"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-2 pb-24 pt-3">
        {reservationsState.reservations.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-neutral-600">
            Nessuna prenotazione. Torna alla lista e premi l&apos;icona
            calendario sul gioco che vuoi prenotare.
          </p>
        )}
        <div className="flex gap-2">
          <div className="w-10 shrink-0 pt-7">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: 60 * PX_PER_MIN }}
                className="text-right pr-1 text-[10px] text-neutral-500"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {EVENT_DAYS.map((d) => {
            const list = blocksByDay.get(d.date) ?? [];
            return (
              <div key={d.date} className="flex-1">
                <div className="sticky top-12 z-10 bg-brand-soft py-1 text-center text-xs font-semibold text-brand-dark">
                  {d.short} {d.date.slice(8)}
                </div>
                <div
                  className="relative border-l border-neutral-200 bg-neutral-50"
                  style={{ height: (EVENT_CLOSE_HOUR - EVENT_OPEN_HOUR) * 60 * PX_PER_MIN }}
                >
                  {HOURS.map((h, idx) =>
                    idx === HOURS.length - 1 ? null : (
                      <div
                        key={h}
                        style={{ top: idx * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                        className="absolute inset-x-0 border-b border-neutral-200"
                      />
                    ),
                  )}
                  {list.map((b) => (
                    <button
                      key={`${b.reservation.itemId}-${b.reservation.reservedAt}`}
                      type="button"
                      onClick={() => b.item && setEditing(b.item)}
                      style={{
                        top: b.topPx,
                        height: Math.max(20, b.heightPx),
                      }}
                      className={
                        "absolute inset-x-0 mx-0.5 rounded px-1.5 py-0.5 text-left text-[10px] leading-tight shadow-sm " +
                        (b.overlapping
                          ? "bg-amber-200 ring-1 ring-amber-500"
                          : "bg-brand text-white")
                      }
                    >
                      <div className="font-semibold">
                        {b.startTime}–{b.endTime}
                      </div>
                      <div className="truncate">
                        {b.item?.name ?? `#${b.reservation.itemId}`}
                      </div>
                      {b.reservation.note && (
                        <div className="truncate opacity-80">
                          {b.reservation.note}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {editing && (
        <ReservationModal
          item={editing}
          existing={
            reservationsState.reservations.find(
              (r) => r.itemId === editing.id,
            ) ?? null
          }
          reservations={reservationsState.reservations}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
