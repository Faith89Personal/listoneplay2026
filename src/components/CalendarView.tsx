"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useItems } from "@/lib/useItems";
import { useReservations } from "@/lib/useReservations";
import { useManualEvents, type ManualEvent } from "@/lib/useManualEvents";
import { useManualItems } from "@/lib/useManualItems";
import { useSession } from "@/lib/useSession";
import {
  EVENT_CLOSE_HOUR,
  EVENT_DAYS,
  EVENT_OPEN_HOUR,
  utcIsoToRomeParts,
} from "@/lib/eventDays";
import {
  type CalendarBlock,
  manualToBlock,
  reservationToBlock,
} from "@/lib/calendarBlocks";
import ReservationModal from "@/components/ReservationModal";
import ManualEventModal from "@/components/ManualEventModal";
import type { Item } from "@/types";
import { CalendarIcon } from "@/components/icons";

const HOURS: number[] = Array.from(
  { length: EVENT_CLOSE_HOUR - EVENT_OPEN_HOUR + 1 },
  (_, i) => EVENT_OPEN_HOUR + i,
);
const PX_PER_MIN = 1.5;

type Positioned = CalendarBlock & {
  topPx: number;
  heightPx: number;
  startTime: string;
  endTime: string;
  overlapping: boolean;
  laneIndex: number;
  laneCount: number;
};

function positionByDay(blocks: CalendarBlock[]): Map<string, Positioned[]> {
  const out = new Map<string, Positioned[]>();
  for (const d of EVENT_DAYS) out.set(d.date, []);
  for (const b of blocks) {
    const p = utcIsoToRomeParts(b.reservedAt);
    const list = out.get(p.date);
    if (!list) continue;
    const minutesFromOpen = (p.hour - EVENT_OPEN_HOUR) * 60 + p.minute;
    const topPx = Math.max(0, minutesFromOpen) * PX_PER_MIN;
    const heightPx = b.durationMinutes * PX_PER_MIN;
    const endMs = new Date(b.reservedAt).getTime() + b.durationMinutes * 60_000;
    const endParts = utcIsoToRomeParts(new Date(endMs).toISOString());
    list.push({
      ...b,
      topPx,
      heightPx,
      startTime: p.time,
      endTime: endParts.time,
      overlapping: false,
      laneIndex: 0,
      laneCount: 1,
    });
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.topPx - b.topPx || b.heightPx - a.heightPx);
    // Mark overlapping flag per block
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aEnd = a.topPx + a.heightPx;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.topPx >= aEnd) break;
        a.overlapping = true;
        b.overlapping = true;
      }
    }
    // Assign lanes per overlap-cluster
    let i = 0;
    while (i < list.length) {
      let clusterEnd = list[i].topPx + list[i].heightPx;
      let j = i + 1;
      while (j < list.length && list[j].topPx < clusterEnd) {
        clusterEnd = Math.max(clusterEnd, list[j].topPx + list[j].heightPx);
        j++;
      }
      const laneEnds: number[] = [];
      for (let k = i; k < j; k++) {
        const b = list[k];
        let lane = laneEnds.findIndex((end) => end <= b.topPx);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[lane] = b.topPx + b.heightPx;
        b.laneIndex = lane;
      }
      const laneCount = laneEnds.length;
      for (let k = i; k < j; k++) list[k].laneCount = laneCount;
      i = j;
    }
  }
  return out;
}

export default function CalendarView() {
  const session = useSession();
  const { data } = useItems();
  const reservationsState = useReservations();
  const manualState = useManualEvents();

  const [editingReservation, setEditingReservation] = useState<Item | null>(
    null,
  );
  const [editingManual, setEditingManual] = useState<ManualEvent | null>(null);
  const [creatingManual, setCreatingManual] = useState<boolean>(false);

  const manualItemsState = useManualItems();
  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    for (const it of manualItemsState.asItems) m.set(it.id, it);
    return m;
  }, [data, manualItemsState.asItems]);

  const blocks: CalendarBlock[] = useMemo(() => {
    const editorStands = data?.editors.editors ?? {};
    const reservationBlocks = reservationsState.reservations.map((r) =>
      reservationToBlock(
        r,
        itemsById.get(r.itemId) ?? null,
        itemsById.get(r.itemId)
          ? (editorStands[itemsById.get(r.itemId)!.editor.name]?.stands ?? [])
          : [],
      ),
    );
    const manualBlocks = manualState.events.map(manualToBlock);
    return [...reservationBlocks, ...manualBlocks];
  }, [reservationsState.reservations, manualState.events, itemsById, data]);

  const blocksByDay = useMemo(() => positionByDay(blocks), [blocks]);

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
      <header className="sticky top-0 z-30 bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          <Link
            href="/"
            aria-label="Torna alla lista"
            className="rounded-md p-1.5 active:bg-white/15"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="20" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-base font-bold tracking-tight">
              Le mie prenotazioni
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreatingManual(true)}
            className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-dark shadow-sm active:bg-white/90"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Aggiungi</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-2 pb-24 pt-4">
        {blocks.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-neutral-600">
            Nessun evento ancora. Aggiungi una prenotazione dalla lista oppure
            un evento manuale con il bottone in alto.
          </p>
        )}
        <div className="flex gap-2">
          <div className="w-10 shrink-0 pt-7">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: 60 * PX_PER_MIN }}
                className="pr-1 text-right text-[10px] text-neutral-500"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {EVENT_DAYS.map((d) => {
            const list = blocksByDay.get(d.date) ?? [];
            return (
              <div key={d.date} className="flex-1">
                <div className="sticky top-12 z-10 rounded-t-md bg-brand-tint py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-brand-dark">
                  {d.short} {d.date.slice(8)}
                </div>
                <div
                  className="relative rounded-b-md border-l border-neutral-200 bg-white"
                  style={{
                    height:
                      (EVENT_CLOSE_HOUR - EVENT_OPEN_HOUR) * 60 * PX_PER_MIN,
                  }}
                >
                  {HOURS.map((h, idx) =>
                    idx === HOURS.length - 1 ? null : (
                      <div
                        key={h}
                        style={{
                          top: idx * 60 * PX_PER_MIN,
                          height: 60 * PX_PER_MIN,
                        }}
                        className="absolute inset-x-0 border-b border-neutral-200"
                      />
                    ),
                  )}
                  {list.map((b) => {
                    const isTall = b.heightPx >= 60;
                    const isManual = b.kind === "manual";
                    const base = b.overlapping
                      ? isManual
                        ? "bg-indigo-400 ring-1 ring-amber-500 text-white"
                        : "bg-brand ring-1 ring-amber-500 text-white"
                      : isManual
                        ? "bg-indigo-500 text-white"
                        : "bg-brand text-white";
                    const leftPct = (b.laneIndex / b.laneCount) * 100;
                    const rightPct =
                      ((b.laneCount - 1 - b.laneIndex) / b.laneCount) * 100;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => {
                          if (b.kind === "reservation" && b.itemId) {
                            const item = itemsById.get(b.itemId);
                            if (item) setEditingReservation(item);
                          } else if (b.kind === "manual" && b.manualId) {
                            const me = manualState.events.find(
                              (m) => m.id === b.manualId,
                            );
                            if (me) setEditingManual(me);
                          }
                        }}
                        style={{
                          top: b.topPx,
                          height: Math.max(20, b.heightPx),
                          left: `calc(${leftPct}% + 1px)`,
                          right: `calc(${rightPct}% + 1px)`,
                        }}
                        className={
                          "absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[10px] leading-tight shadow-sm " +
                          base
                        }
                      >
                        <div className="font-semibold">
                          {b.startTime}–{b.endTime}
                        </div>
                        <div className="truncate font-medium">{b.title}</div>
                        {(b.editorName || b.stand) && (
                          <div className="flex items-baseline gap-1 truncate text-[9px] opacity-90">
                            {b.editorName && (
                              <span className="truncate">{b.editorName}</span>
                            )}
                            {b.stand && (
                              <span className="shrink-0 font-bold">
                                · {b.stand}
                              </span>
                            )}
                          </div>
                        )}
                        {isTall && b.note && (
                          <div className="truncate text-[9px] italic opacity-80">
                            {b.note}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {editingReservation && (
        <ReservationModal
          item={editingReservation}
          existing={
            reservationsState.reservations.find(
              (r) => r.itemId === editingReservation.id,
            ) ?? null
          }
          allBlocks={blocks}
          onClose={() => setEditingReservation(null)}
        />
      )}
      {editingManual && (
        <ManualEventModal
          existing={editingManual}
          allBlocks={blocks}
          onClose={() => setEditingManual(null)}
        />
      )}
      {creatingManual && (
        <ManualEventModal
          existing={null}
          allBlocks={blocks}
          onClose={() => setCreatingManual(false)}
        />
      )}
    </>
  );
}
