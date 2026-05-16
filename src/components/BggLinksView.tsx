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
          Solo giochi da tavolo.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="rounded bg-brand px-1.5 py-0.5 font-semibold text-white">
              BGG
            </span>
            scheda diretta
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
              cerca
            </span>
            ricerca (nessun match diretto)
          </span>
        </div>
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
                  {it.idBgg ? (
                    <a
                      href={bggUrl(it)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Scheda BoardGameGeek"
                      className="flex shrink-0 items-center gap-1 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white active:bg-brand-dark"
                    >
                      BGG
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  ) : (
                    <a
                      href={bggUrl(it)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ricerca su BoardGameGeek (nessun match diretto)"
                      className="flex shrink-0 items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 active:bg-amber-100"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.5" y2="16.5" />
                      </svg>
                      cerca
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
