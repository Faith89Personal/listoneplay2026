"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/types";
import { type Play, usePlays } from "@/lib/usePlays";
import { CloseIcon, StarIcon } from "@/components/icons";

type Props = {
  item: Item;
  existing: Play | null;
  onClose: () => void;
};

export default function PlayedModal({ item, existing, onClose }: Props) {
  const { save, remove } = usePlays();
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [bought, setBought] = useState<boolean>(existing?.bought ?? false);
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
    if (rating < 1) {
      setError("invalid_rating");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        itemId: item.id,
        rating,
        note: note.trim() || null,
        bought,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
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

  const shown = hover || rating;

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
              {existing ? "Modifica voto" : "Ci hai giocato?"}
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

        <div className="space-y-3">
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
              Nota (opzionale)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="es. troppo lungo, simpatico in coppia"
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => setBought((v) => !v)}
            aria-pressed={bought}
            className={
              "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left " +
              (bought
                ? "border-brand-dark bg-brand-soft"
                : "border-neutral-300 bg-white")
            }
          >
            <span className="text-sm font-medium text-neutral-800">
              Lo compresti?
            </span>
            <span
              className={
                "relative h-5 w-9 shrink-0 rounded-full transition-colors " +
                (bought ? "bg-brand" : "bg-neutral-300")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
                  (bought ? "left-[18px]" : "left-0.5")
                }
              />
            </span>
          </button>

          {error && (
            <p
              role="alert"
              className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              {error === "invalid_rating"
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
              disabled={busy || rating < 1}
              onClick={commit}
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
