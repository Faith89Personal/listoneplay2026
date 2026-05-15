"use client";

import { useEffect, useState } from "react";
import { type ManualPlay, useManualPlays } from "@/lib/useManualPlays";
import { EVENT_DAYS } from "@/lib/eventDays";
import { CloseIcon, StarIcon } from "@/components/icons";

type Props = {
  existing: ManualPlay | null;
  onClose: () => void;
};

export default function ManualPlayedModal({ existing, onClose }: Props) {
  const { save, remove } = useManualPlays();
  const [name, setName] = useState<string>(existing?.name ?? "");
  const [editor, setEditor] = useState<string>(existing?.editor ?? "");
  const [playedOn, setPlayedOn] = useState<string>(existing?.playedOn ?? "");
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function commit() {
    const cleanedName = name.trim();
    if (!cleanedName) {
      setError("invalid_name");
      return;
    }
    if (rating < 1) {
      setError("invalid_rating");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        id: existing?.id,
        name: cleanedName,
        editor: editor.trim() || null,
        playedOn: playedOn || null,
        rating,
        note: note.trim() || null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await remove(existing.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-900">
              {existing ? "Modifica gioco" : "Nuovo gioco giocato"}
            </h2>
            <p className="text-xs text-neutral-600">
              Per giochi non presenti nel listone GSNT.
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

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Nome
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="es. Wingspan"
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              required
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Voto
            </span>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHover(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} stell${n === 1 ? "a" : "e"}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className={
                    "rounded p-1 " +
                    (shown >= n ? "text-amber-500" : "text-neutral-300")
                  }
                >
                  <StarIcon filled={shown >= n} className="h-7 w-7" />
                </button>
              ))}
              {rating > 0 && (
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className="ml-2 text-[11px] text-neutral-500 underline"
                >
                  azzera
                </button>
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Editore (opzionale)
            </span>
            <input
              type="text"
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              maxLength={200}
              placeholder="es. Stonemaier Games"
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Giorno (opzionale)
            </span>
            <div className="flex gap-1">
              {EVENT_DAYS.map((d) => {
                const active = playedOn === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setPlayedOn(active ? "" : d.date)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium " +
                      (active
                        ? "border-brand-dark bg-brand text-white"
                        : "border-neutral-300 bg-white text-neutral-700")
                    }
                  >
                    {d.long}
                  </button>
                );
              })}
            </div>
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
              placeholder="es. partita in 4, finita 90/82"
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              {error === "invalid_name"
                ? "Il nome è obbligatorio"
                : error === "invalid_rating"
                  ? "Scegli un voto da 1 a 5"
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
              onClick={commit}
              disabled={busy || rating < 1 || name.trim().length === 0}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "…" : existing ? "Aggiorna" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
