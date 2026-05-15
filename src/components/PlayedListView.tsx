"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useItems } from "@/lib/useItems";
import { usePlays } from "@/lib/usePlays";
import { useSession } from "@/lib/useSession";
import PlayedModal from "@/components/PlayedModal";
import { StarIcon } from "@/components/icons";
import type { Item } from "@/types";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          filled={rating >= n}
          className={
            "h-4 w-4 " + (rating >= n ? "text-amber-500" : "text-neutral-300")
          }
        />
      ))}
    </div>
  );
}

export default function PlayedListView() {
  const session = useSession();
  const { data } = useItems();
  const playsState = usePlays();
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    return m;
  }, [data]);

  const rows = useMemo(() => {
    return playsState.plays
      .map((p) => ({ play: p, item: itemsById.get(p.itemId) ?? null }))
      .sort((a, b) => {
        if (a.play.rating !== b.play.rating) return b.play.rating - a.play.rating;
        const an = a.item?.name ?? "";
        const bn = b.item?.name ?? "";
        return an.localeCompare(bn, "it");
      });
  }, [playsState.plays, itemsById]);

  if (session.loading) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-10 text-center text-sm text-neutral-500">
        Carico…
      </div>
    );
  }
  if (!session.email) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-10 text-center">
        <p className="text-sm text-neutral-700">
          Devi essere connesso per vedere i giochi a cui hai giocato.
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
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
          <Link
            href="/"
            aria-label="Torna alla lista"
            className="rounded p-1.5 active:bg-white/15"
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
            <span className="text-base font-bold">Giocati e votati</span>
            <span className="text-[11px] opacity-80">
              {rows.length} {rows.length === 1 ? "gioco" : "giochi"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">
        {rows.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-neutral-600">
            Nessun gioco giocato. Apri la lista e premi l&apos;icona stella
            sul gioco a cui hai giocato per dargli un voto.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-white shadow-sm">
            {rows.map(({ play, item }) => (
              <li key={play.itemId}>
                <button
                  type="button"
                  onClick={() => item && setEditingItem(item)}
                  disabled={!item}
                  className="flex w-full flex-col gap-1 px-3 py-2 text-left text-sm active:bg-neutral-50 disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <Stars rating={play.rating} />
                    <span className="text-xs font-bold text-amber-600">
                      {play.rating}/5
                    </span>
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">
                      {item?.name ?? `#${play.itemId}`}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item?.editor.name ?? ""}
                    </span>
                    {play.note && (
                      <span className="mt-0.5 text-xs italic text-neutral-600">
                        {play.note}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editingItem && (
        <PlayedModal
          item={editingItem}
          existing={
            playsState.plays.find((p) => p.itemId === editingItem.id) ?? null
          }
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
