"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/types";
import { useRushes } from "@/lib/useRushes";
import { EVENT_DAYS } from "@/lib/eventDays";
import { AlarmIcon, CloseIcon } from "@/components/icons";

type Props = {
  item: Item;
  stand: string | null;
  onClose: () => void;
};

export default function RushModal({ item, stand, onClose }: Props) {
  const { rushes, toggle } = useRushes();
  const activeDays = new Set(
    rushes.filter((r) => r.itemId === item.id).map((r) => r.day),
  );
  const [flashBusy, setFlashBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-neutral-900">
              <AlarmIcon className="h-5 w-5 text-amber-500" />
              Rush mattina
            </h2>
            <p className="line-clamp-2 text-sm text-neutral-700">{item.name}</p>
            {stand && (
              <p className="mt-1 text-xs text-neutral-500">
                Stand: <span className="font-semibold">{stand}</span>
              </p>
            )}
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

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Rush mattina
          </p>
          <p className="mb-2 text-xs text-neutral-600">
            Seleziona i giorni in cui vuoi essere ricordato di andare allo
            stand presto per prenotare un tavolo.
          </p>
          <div className="flex gap-1.5">
            {EVENT_DAYS.map((d) => {
              const active = activeDays.has(d.date);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => toggle(item.id, d.date, active)}
                  className={
                    "flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors " +
                    (active
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-neutral-300 bg-white text-neutral-700")
                  }
                >
                  {d.long}
                </button>
              );
            })}
          </div>
        </div>

        <div className="my-4 border-t border-neutral-200" />

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Avviso veloce
          </p>
          <p className="mb-2 text-xs text-neutral-600">
            Manda subito un messaggio agli amici per dire che il tavolo
            si sta per liberare.
          </p>
          <button
            type="button"
            disabled={flashBusy}
            onClick={async () => {
              setFlashBusy(true);
              try {
                const standLine = stand ? `\n📍 Stand ${stand}` : "";
                const editorLine = item.editor?.name
                  ? `\n🏢 ${item.editor.name}`
                  : "";
                const bggLine = item.idBgg
                  ? `\n🔗 https://boardgamegeek.com/boardgame/${item.idBgg}`
                  : "";
                const text =
                  `⚡ Si sta per liberare: ${item.name}` +
                  editorLine +
                  standLine +
                  bggLine +
                  `\n\nQualcuno vuole unirsi? Me lo dica subito!`;
                if (typeof navigator !== "undefined" && navigator.share) {
                  try {
                    await navigator.share({ text });
                    return;
                  } catch {
                    // fall through
                  }
                }
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(text);
                  alert("Messaggio copiato negli appunti");
                }
              } finally {
                setFlashBusy(false);
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white active:bg-amber-600 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
            </svg>
            {flashBusy ? "…" : "Si sta per liberare — invia"}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
