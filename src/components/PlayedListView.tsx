"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useItems } from "@/lib/useItems";
import { usePlays } from "@/lib/usePlays";
import { useManualPlays, type ManualPlay } from "@/lib/useManualPlays";
import { useManualItems } from "@/lib/useManualItems";
import { useSession } from "@/lib/useSession";
import PlayedModal from "@/components/PlayedModal";
import ManualPlayedModal from "@/components/ManualPlayedModal";
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

type CatalogRow = {
  kind: "catalog";
  key: string;
  rating: number;
  name: string;
  editor: string;
  note: string | null;
  bought: boolean;
  item: Item;
};
type ManualRow = {
  kind: "manual";
  key: string;
  rating: number;
  name: string;
  editor: string;
  note: string | null;
  bought: boolean;
  playedOn: string | null;
  manual: ManualPlay;
};
type Row = CatalogRow | ManualRow;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function PlayedListView() {
  const session = useSession();
  const { data } = useItems();
  const playsState = usePlays();
  const manualState = useManualPlays();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingManual, setEditingManual] = useState<ManualPlay | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);

  const manualItemsState = useManualItems();
  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    for (const it of manualItemsState.asItems) m.set(it.id, it);
    return m;
  }, [data, manualItemsState.asItems]);

  const rows: Row[] = useMemo(() => {
    const catalog: CatalogRow[] = playsState.plays
      .map((p) => {
        const item = itemsById.get(p.itemId);
        if (!item) return null;
        return {
          kind: "catalog" as const,
          key: `c:${p.itemId}`,
          rating: p.rating,
          name: item.name,
          editor: item.editor.name,
          note: p.note,
          bought: p.bought,
          item,
        };
      })
      .filter((r): r is CatalogRow => r !== null);

    const manual: ManualRow[] = manualState.plays.map((p) => ({
      kind: "manual" as const,
      key: `m:${p.id}`,
      rating: p.rating,
      name: p.name,
      editor: p.editor ?? "",
      note: p.note,
      bought: p.bought,
      playedOn: p.playedOn,
      manual: p,
    }));

    return [...catalog, ...manual].sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      return a.name.localeCompare(b.name, "it");
    });
  }, [playsState.plays, manualState.plays, itemsById]);

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
          className="mt-3 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow"
        >
          Torna alla lista
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
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
              Giocati e votati
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreatingManual(true)}
            className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-dark shadow-sm active:bg-white/90"
          >
            <StarIcon filled className="h-4 w-4 text-amber-500" />
            <span>Aggiungi</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-4">
        {rows.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-neutral-600">
            Nessun gioco giocato. Apri la lista e premi l&apos;icona stella
            sul gioco, oppure usa &laquo;Aggiungi&raquo; per inserire un gioco
            fuori dal listone.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => {
              const date = r.kind === "manual" ? formatDate(r.playedOn) : null;
              const isManual = r.kind === "manual";
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (r.kind === "catalog") setEditingItem(r.item);
                      else setEditingManual(r.manual);
                    }}
                    className={
                      "w-full rounded-2xl text-left shadow-sm ring-1 active:bg-neutral-50 " +
                      (isManual
                        ? "bg-white ring-indigo-200"
                        : "bg-white ring-neutral-200")
                    }
                  >
                    <div className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-xs font-bold text-amber-600">
                          {r.rating}/5
                        </span>
                        {r.bought && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Comprato
                          </span>
                        )}
                        {isManual && (
                          <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                            Manuale
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-neutral-900">
                          {r.name}
                        </span>
                        {r.editor && (
                          <span className="text-xs text-neutral-500">
                            {r.editor}
                          </span>
                        )}
                        {date && (
                          <span className="text-xs text-neutral-500">
                            {date}
                          </span>
                        )}
                        {r.note && (
                          <span className="mt-0.5 text-xs italic text-neutral-600">
                            {r.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
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
      {editingManual && (
        <ManualPlayedModal
          existing={editingManual}
          onClose={() => setEditingManual(null)}
        />
      )}
      {creatingManual && (
        <ManualPlayedModal
          existing={null}
          onClose={() => setCreatingManual(false)}
        />
      )}
    </>
  );
}
