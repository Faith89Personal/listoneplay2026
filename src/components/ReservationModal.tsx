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
  stand: string | null;
  editorName: string | null;
  onClose: () => void;
};

function emailToName(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function nextGuestPlaceholder(existing: string[]): string {
  let n = 1;
  while (existing.includes(`Guest ${n}`)) n += 1;
  return `Guest ${n}`;
}

export default function ReservationModal({
  item,
  existing,
  allBlocks,
  stand,
  editorName,
  onClose,
}: Props) {
  const { save, remove, participantNames } = useReservations();
  const initial = existing ? utcIsoToRomeParts(existing.reservedAt) : null;

  const [date, setDate] = useState<string>(
    initial?.date ?? EVENT_DAYS[0].date,
  );
  const [time, setTime] = useState<string>(initial?.time ?? "14:00");
  const [duration, setDuration] = useState<number>(
    existing?.durationMinutes ?? 60,
  );
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [maxSeats, setMaxSeats] = useState<number | null>(
    existing?.maxSeats ?? null,
  );
  const [guests, setGuests] = useState<string[]>(existing?.guests ?? []);
  const [guestInput, setGuestInput] = useState<string>("");
  const [sharedWith, setSharedWith] = useState<string[]>(
    existing?.sharedWith ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlapsPending, setOverlapsPending] = useState<
    CalendarBlock[] | null
  >(null);
  const [savedToken, setSavedToken] = useState<string | null>(null);

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
      const result = await save({
        itemId: item.id,
        reservedAt: candidate.reservedAt,
        durationMinutes: duration,
        note: note.trim() || null,
        maxSeats: maxSeats,
        guests,
        sharedWith,
      });
      setSavedToken(
        result.shareToken ?? existing?.shareToken ?? null,
      );
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

  async function handleLeaveShared() {
    if (!existing?.shareToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/r/${existing.shareToken}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `http_${res.status}`);
      }
      // Page state will refresh via the parent hook on next call; just close.
      onClose();
      // Trigger a manual reload of the shared list by reloading the page is too heavy.
      // Caller of this modal already passes a stale reservation; the next reload of
      // useReservations will drop it. For now, request a hard refresh through location.
      if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runShare(shareToken: string) {
    setShareBusy(true);
    try {
      const url = `${window.location.origin}/r/${shareToken}`;
      const range = formatRangeShort(candidate.reservedAt, duration);
      const seatLine =
        maxSeats !== null
          ? `\n👥 ${1 + sharedWith.length + guests.length}/${maxSeats} posti occupati`
          : "";
      const editorPart = editorName ? `🏢 ${editorName}` : "";
      const standPart = stand ? `📍 ${stand}` : "";
      const editorLine =
        editorPart && standPart
          ? `\n${editorPart} · ${standPart}`
          : editorPart || standPart
            ? `\n${editorPart}${standPart}`
            : "";
      const text =
        `🎲 Sto prenotando: ${item.name}` +
        editorLine +
        `\n📅 ${range}` +
        seatLine +
        `\n\nUnisciti 👉 ${url}`;
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch {
          // fall through to copy
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert("Messaggio copiato negli appunti");
      }
    } finally {
      setShareBusy(false);
    }
  }

  const isShared = !!existing && !existing.isOwner;

  if (savedToken !== null) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 13 10 18 19 7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-neutral-900">
              Prenotazione salvata
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Vuoi condividerla subito su WhatsApp?
            </p>
          </div>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              disabled={shareBusy}
              onClick={async () => {
                await runShare(savedToken);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {shareBusy ? "…" : "Sì, condividi"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700"
            >
              No grazie, chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isShared) {
    const ownerEmail = existing?.ownerEmail;
    const ownerName = ownerEmail
      ? participantNames[ownerEmail] || emailToName(ownerEmail)
      : "qualcuno";
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
              <h2 className="text-base font-semibold text-sky-700">
                Prenotazione condivisa
              </h2>
              <p className="line-clamp-2 text-sm text-neutral-700">{item.name}</p>
              <p className="text-xs text-neutral-500">
                Da <span className="font-semibold">{ownerName}</span>
              </p>
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

          <div className="space-y-2 text-sm text-neutral-800">
            <p>
              📅{" "}
              {(EVENT_DAYS.find(
                (d) => d.date === utcIsoToRomeParts(existing.reservedAt).date,
              )?.long ?? "")}{" "}
              ·{" "}
              {formatRangeShort(existing.reservedAt, existing.durationMinutes)}
            </p>
            {(editorName || stand) && (
              <p>
                {editorName && <span>🏢 {editorName}</span>}
                {editorName && stand ? " · " : ""}
                {stand && <span>📍 {stand}</span>}
              </p>
            )}
            {existing.maxSeats !== null && (
              <p className="text-amber-700">
                👥{" "}
                {1 + existing.sharedWith.length + existing.guests.length}/
                {existing.maxSeats} posti occupati
              </p>
            )}
            {(existing.sharedWith.length > 0 ||
              existing.guests.length > 0) && (
              <p className="text-xs text-neutral-600">
                Insieme a te:{" "}
                {[
                  ...existing.sharedWith
                    .filter((e) => e !== existing.ownerEmail)
                    .map((e) => participantNames[e] || emailToName(e)),
                  ...existing.guests.map((g) => `${g} (guest)`),
                ].join(", ")}
              </p>
            )}
            {existing.note && (
              <p className="rounded-md bg-neutral-50 p-2 text-xs italic text-neutral-700">
                &laquo;{existing.note}&raquo;
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
              Errore: {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleLeaveShared}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 active:bg-red-50 disabled:opacity-50"
            >
              {busy ? "…" : "Rimuovi dal mio calendario"}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
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

            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Posti totali (opzionale)
              </span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = maxSeats === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxSeats(active ? null : n)}
                      className={
                        "flex-1 rounded-md border py-1.5 text-sm font-medium " +
                        (active
                          ? "border-brand-dark bg-brand text-white"
                          : "border-neutral-300 bg-white text-neutral-700")
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Guest (opzionale, contano nei posti occupati)
              </span>
              {(() => {
                const occupied = 1 + sharedWith.length + guests.length;
                const full = maxSeats !== null && occupied >= maxSeats;
                const tryAdd = () => {
                  if (full) return;
                  const v = guestInput.trim() || nextGuestPlaceholder(guests);
                  if (!guests.includes(v) && guests.length < 20) {
                    setGuests([...guests, v]);
                  }
                  setGuestInput("");
                };
                return (
                  <>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={guestInput}
                        onChange={(e) => setGuestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            tryAdd();
                          }
                        }}
                        maxLength={80}
                        placeholder={
                          full
                            ? "Posti pieni"
                            : "es. Marco · invio per aggiungere"
                        }
                        disabled={full}
                        className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={tryAdd}
                        disabled={full}
                        className="rounded-md bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    {full && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Posti pieni ({occupied}/{maxSeats}). Aumenta i posti
                        totali oppure rimuovi un partecipante.
                      </p>
                    )}
                  </>
                );
              })()}
              {guests.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {guests.map((g) => (
                    <li
                      key={g}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-800"
                    >
                      {g}
                      <button
                        type="button"
                        aria-label={`Rimuovi ${g}`}
                        onClick={() =>
                          setGuests(guests.filter((x) => x !== g))
                        }
                        className="text-neutral-500"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
                onClick={() => runShare(existing.shareToken!)}
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

            {existing &&
              existing.isOwner &&
              (sharedWith.length > 0 || guests.length > 0) && (
                <div className="rounded-md bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                  <span className="text-xs font-semibold text-emerald-900">
                    Partecipanti
                  </span>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {sharedWith.map((email) => (
                      <li
                        key={`s:${email}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-neutral-800 ring-1 ring-emerald-200"
                      >
                        {participantNames[email] || emailToName(email)}
                        <button
                          type="button"
                          aria-label={`Rimuovi ${email}`}
                          onClick={() =>
                            setSharedWith(sharedWith.filter((x) => x !== email))
                          }
                          className="text-neutral-500"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {guests.map((g) => (
                      <li
                        key={`g:${g}`}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      >
                        {g}
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          guest
                        </span>
                        <button
                          type="button"
                          aria-label={`Rimuovi guest ${g}`}
                          onClick={() =>
                            setGuests(guests.filter((x) => x !== g))
                          }
                          className="text-neutral-500"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                {error === "exceeds_max_seats"
                  ? "Troppi partecipanti per i posti totali impostati."
                  : `Errore: ${error}`}
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
