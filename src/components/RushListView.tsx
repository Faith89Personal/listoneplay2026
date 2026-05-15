"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useItems } from "@/lib/useItems";
import { useManualItems } from "@/lib/useManualItems";
import { useRushes } from "@/lib/useRushes";
import { useSession } from "@/lib/useSession";
import RushModal from "@/components/RushModal";
import { AlarmIcon } from "@/components/icons";
import { EVENT_DAYS, utcIsoToRomeParts } from "@/lib/eventDays";
import type { Item } from "@/types";

function defaultDay(): string {
  const nowRome = utcIsoToRomeParts(new Date().toISOString());
  const today = EVENT_DAYS.find((d) => d.date === nowRome.date);
  return today?.date ?? EVENT_DAYS[0].date;
}

export default function RushListView() {
  const session = useSession();
  const { data } = useItems();
  const manualItemsState = useManualItems();
  const rushesState = useRushes();
  const [day, setDay] = useState<string>(defaultDay());
  const [editing, setEditing] = useState<Item | null>(null);

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    for (const it of manualItemsState.asItems) m.set(it.id, it);
    return m;
  }, [data, manualItemsState.asItems]);

  const editorsSnap = data?.editors ?? { source: "", generatedAt: "", editors: {} };

  type Row = { item: Item; stand: string; standSort: string };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const r of rushesState.rushes) {
      if (r.day !== day) continue;
      const item = itemsById.get(r.itemId);
      if (!item) continue;
      const editorInfo = editorsSnap.editors[item.editor.name];
      const stands = editorInfo?.stands ?? [];
      const stand = stands.join("·") || "—";
      const standSort = stands[0] ?? "ZZZ99";
      out.push({ item, stand, standSort });
    }
    out.sort((a, b) => {
      const cmp = a.standSort.localeCompare(b.standSort, "en", {
        numeric: true,
      });
      if (cmp !== 0) return cmp;
      return a.item.name.localeCompare(b.item.name, "it");
    });
    return out;
  }, [rushesState.rushes, day, itemsById, editorsSnap]);

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
          Devi essere connesso per vedere i rush mattina.
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
            <span className="flex items-center gap-1.5 text-base font-bold tracking-tight">
              <AlarmIcon className="h-5 w-5" />
              Rush mattina
            </span>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1.5 px-3 pb-3">
          {EVENT_DAYS.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setDay(d.date)}
              className={
                "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                (day === d.date
                  ? "bg-white text-brand-dark shadow-sm"
                  : "bg-white/15 text-white active:bg-white/25")
              }
            >
              {d.long}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-4">
        {rows.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-neutral-600">
            Nessun gioco da prenotare la mattina per questo giorno. Apri la
            lista e premi l&apos;icona sveglia sul gioco per cui devi correre
            allo stand.
          </p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map(({ item, stand }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex w-full items-start gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-neutral-200 active:bg-neutral-50"
                >
                  <span className="mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">
                    {stand}
                  </span>
                  <div className="flex flex-1 flex-col leading-tight">
                    <span className="text-sm font-semibold text-neutral-900">
                      {item.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.editor.name}
                    </span>
                  </div>
                  <AlarmIcon className="h-5 w-5 shrink-0 text-amber-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <RushModal
          item={editing}
          stand={(() => {
            const ed = editorsSnap.editors[editing.editor.name];
            return ed?.stands?.join("·") ?? null;
          })()}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
