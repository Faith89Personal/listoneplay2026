"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/types";

const BOARDGAME_CATEGORY = "GIOCHI DA TAVOLO";

function bggSearchUrl(name: string): string {
  return (
    "https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=" +
    encodeURIComponent(name)
  );
}

function bggUrl(it: Item): string {
  return it.idBgg
    ? `https://boardgamegeek.com/boardgame/${it.idBgg}`
    : bggSearchUrl(it.name);
}

export default function BggLinksView() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/items", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`items_${r.status}`);
        return r.json() as Promise<Item[]>;
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    const byEditor = new Map<string, Item[]>();
    for (const it of items) {
      if (it.category?.name !== BOARDGAME_CATEGORY) continue;
      const key = it.editor.name?.trim() || "(Senza editore)";
      const list = byEditor.get(key);
      if (list) list.push(it);
      else byEditor.set(key, [it]);
    }
    const out = [...byEditor.entries()].map(([editorName, list]) => ({
      editorName,
      items: list.slice().sort((a, b) => a.name.localeCompare(b.name, "it")),
    }));
    out.sort((a, b) => a.editorName.localeCompare(b.editorName, "it"));
    return out;
  }, [items]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          Giochi · ricerca BoardGameGeek
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Solo giochi da tavolo. Il link punta alla scheda BoardGameGeek
          (alla ricerca se non ancora risolto).
        </p>
      </header>

      {error && !items && (
        <p className="py-10 text-center text-sm text-red-600">
          Errore nel caricamento dei giochi ({error}).
        </p>
      )}
      {!items && !error && (
        <p className="py-10 text-center text-sm text-neutral-500">Carico…</p>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.editorName}>
            <h2 className="mb-2 border-b border-neutral-200 pb-1 text-sm font-bold uppercase tracking-wide text-brand-dark">
              {g.editorName}
            </h2>
            <ul className="divide-y divide-neutral-100">
              {g.items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                    {it.name}
                  </span>
                  <a
                    href={bggUrl(it)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white active:bg-brand-dark"
                  >
                    BGG
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
