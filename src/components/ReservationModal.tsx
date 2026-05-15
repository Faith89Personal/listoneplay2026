"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/types";
import { type Reservation, useReservations } from "@/lib/useReservations";
import {
  type CalendarBlock,
  findBlockOverlaps,
  reservationKey,
} from "@/lib/calendarBlocks";
import {
  EVENT_CLOSE_HOUR,
  EVENT_DAYS,
  EVENT_OPEN_HOUR,
  formatRangeShort,
  romeLocalToUtcIso,
  utcIsoToRomeParts,
} from "@/lib/eventDays";
import { CloseIcon } from "@/components/icons";

const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = EVENT_OPEN_HOUR; h < EVENT_CLOSE_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  out.push(`${String(EVENT_CLOSE_HOUR).padStart(2, "0")}:00`);
  return out;
})();

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180];

type Props = {
  item: Item;
  existing: Reservation | null;
  allBlocks: CalendarBlock[];
  onClose: () => void;
};

export default function ReservationModal({
  item,
  existing,
  allBlocks,
  onClose,
}: Props) {
  const { save, remove } = useReservations();
  const initial = existing ? utcIsoToRomeParts(existing.reservedAt) : null;

  const [date, setDate] = useState<string>(
    initial?.date ?? EVENT_DAYS[0].date,
  );
  const [time, setTime] = useState<string>(initial?.time ?? "14:00");
  const [duration, setDuration] = useState<number>(
    existing?.durationMinutes ?? 60,
  );
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [maxSeats, setMaxSeats] = useState<string>(
    existing?.maxSeats ? String(existing.maxSeats) : "",
  );
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlapsPending, setOverlapsPending] = useState<
    CalendarBlock[] | null
  >(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const candidate = useMemo(
    () => ({
      key: reservationKey(item.id),
      reservedAt: romeLocalToUtcIso(date, time),
      durationMinutes: duration,
    }),
    [item.id, date, time, duration],
  );

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const seatsNum = Number(maxSeats);
      const seatsValid =
        maxSeats.trim().length > 0 &&
        Number.isFinite(seatsNum) &&
        seatsNum >= 2 &&
        seatsNum <= 20;
      await save({
        itemId: item.id,
        reservedAt: candidate.reservedAt,
        durationMinutes: duration,
        note: note.trim() || null,
        maxSeats: seatsValid ? Math.round(seatsNum) : null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSaveClick() {
    const o = findBlockOverlaps(candidate, allBlocks);
    if (o.length > 0) {
      setOverlapsPending(o);
      return;
    }
    void commit();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await remove(item.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-brand-dark">
              {existing ? "Modifica prenotazione" : "Prenota tavolo"}
            </h2>
            <p className="line-clamp-2 text-sm text-neutral-700">{item.name}</p>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 active:bg-neutral-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {!overlapsPending && (
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Giorno
              </span>
              <div className="flex gap-1">
                {EVENT_DAYS.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setDate(d.date)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium " +
                      (date === d.date
                        ? "border-brand-dark bg-brand text-white"
                        : "border-neutral-300 bg-white text-neutral-700")
                    }
                  >
                    {d.long}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">
                  Inizio
                </span>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">
                  Durata (min)
                </span>
                <input
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  value={duration}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setDuration(v);
                  }}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={
                        "rounded border px-1.5 py-0.5 text-[10px] " +
                        (duration === d
                          ? "border-brand bg-brand-soft"
                          : "border-neutral-200 bg-white text-neutral-600")
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Posti totali (opzionale, per il messaggio di condivisione)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={20}
                value={maxSeats}
                onChange={(e) => setMaxSeats(e.target.value)}
                placeholder="es. 4"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Nota (opzionale)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="es. con Marco e Giulia"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>

            {existing?.shareToken && existing.isOwner && (
              <button
                type="button"
                disabled={shareBusy}
                onClick={async () => {
                  setShareBusy(true);
                  try {
                    const url = `${window.location.origin}/r/${existing.shareToken}`;
                    const dayLabel =
                      EVENT_DAYS.find(
                        (d) =>
                          d.date === utcIsoToRomeParts(existing.reservedAt).date,
                      )?.short ?? "";
                    const range = formatRangeShort(
                      existing.reservedAt,
                      existing.durationMinutes,
                    );
                    const occupied = 1 + existing.sharedWith.length;
                    const seatsLine =
                      existing.maxSeats
                        ? `\n👥 ${occupied}/${existing.maxSeats} posti occupati`
                        : "";
                    const text =
                      `🎲 Sto prenotando: ${item.name}\n` +
                      `📅 ${dayLabel} ${range}` +
                      seatsLine +
                      `\n\nUnisciti 👉 ${url}`;
                    if (typeof navigator !== "undefined" && navigator.share) {
                      try {
                        await navigator.share({ text });
                        return;
                      } catch {
                        // fall back to clipboard
                      }
                    }
                    if (
                      typeof navigator !== "undefined" &&
                      navigator.clipboard
                    ) {
                      await navigator.clipboard.writeText(text);
                      alert("Messaggio copiato negli appunti");
                    }
                  } finally {
                    setShareBusy(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                {shareBusy ? "…" : "Condividi su WhatsApp"}
              </button>
            )}

            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                Errore: {error}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {existing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 active:bg-red-50 disabled:opacity-50"
                >
                  Rimuovi
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveClick}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : existing ? "Aggiorna" : "Prenota"}
              </button>
            </div>
          </div>
        )}

        {overlapsPending && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-800">
              Questa prenotazione si sovrappone a:
            </p>
            <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {overlapsPending.map((b) => (
                <li key={b.key}>
                  &middot;{" "}
                  <span className="font-medium">
                    {formatRangeShort(b.reservedAt, b.durationMinutes)}
                  </span>{" "}
                  <span>{b.title}</span>
                  {b.note ? (
                    <span className="text-amber-800"> — {b.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-sm text-neutral-700">
              Procedere comunque con la prenotazione?
            </p>
            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                Errore: {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOverlapsPending(null)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
              >
                Modifica orario
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOverlapsPending(null);
                  void commit();
                }}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : "Procedi"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
