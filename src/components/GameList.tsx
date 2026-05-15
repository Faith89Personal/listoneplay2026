"use client";

import { useMemo, useRef, useState } from "react";
import type { Item } from "@/types";
import { useSelections } from "@/lib/storage";
import { useItems } from "@/lib/useItems";
import GameRow from "@/components/GameRow";
import { SearchIcon, CloseIcon, MenuIcon } from "@/components/icons";

type Section = { category: { id: number; name: string }; items: Item[] };

function buildSections(items: Item[]): Section[] {
  const byCat = new Map<number, Section>();
  for (const item of items) {
    let s = byCat.get(item.category.id);
    if (!s) {
      s = {
        category: { id: item.category.id, name: item.category.name },
        items: [],
      };
      byCat.set(item.category.id, s);
    }
    s.items.push(item);
  }
  for (const s of byCat.values()) {
    s.items.sort((a, b) => a.name.localeCompare(b.name, "it"));
  }
  return [...byCat.values()].sort((a, b) => {
    const ao = items.find((i) => i.category.id === a.category.id)!.category
      .ordering;
    const bo = items.find((i) => i.category.id === b.category.id)!.category
      .ordering;
    return ao - bo;
  });
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function GameList() {
  const { data, loading, error, stale, refresh } = useItems();
  const { selections, toggle, hydrated } = useSelections();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const items = data?.items ?? [];

  const sections = useMemo(() => buildSections(items), [items]);

  const filteredSections = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) =>
            normalize(it.name).includes(q) ||
            normalize(it.editor.name).includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  const totalShown = filteredSections.reduce((n, s) => n + s.items.length, 0);
  const selectedCount = hydrated ? Object.keys(selections).length : 0;

  function scrollToCategory(id: number) {
    setMenuOpen(false);
    const el = sectionRefs.current[id];
    if (el) {
      const header = document.getElementById("app-header");
      const offset = (header?.offsetHeight ?? 0) + 4;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  const showEmptyState = !loading && items.length === 0;

  return (
    <>
      <header
        id="app-header"
        className="sticky top-0 z-30 bg-brand text-white shadow"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Apri menu categorie"
            className="rounded p-1.5 active:bg-white/15"
          >
            {menuOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-base font-bold">Listone Play 2026</span>
            <span className="text-[11px] opacity-80">
              {items.length > 0
                ? `${totalShown} di ${items.length} titoli`
                : loading
                  ? "Carico…"
                  : "Lista non disponibile"}
              {selectedCount > 0 ? ` · ${selectedCount} selezionati` : ""}
              {stale ? " · cache" : ""}
            </span>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2">
          <div className="flex flex-1 items-center gap-2 rounded-md bg-white/95 px-2 py-1 text-neutral-700 shadow-inner">
            <SearchIcon className="h-4 w-4 text-neutral-500" />
            <input
              type="search"
              inputMode="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca titolo o editore…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Pulisci ricerca"
                className="text-neutral-500"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {menuOpen && (
          <nav className="mx-auto max-w-2xl border-t border-white/20 bg-brand-dark/95 px-3 py-2">
            <ul className="flex flex-col gap-1 text-sm">
              {sections.map((s) => (
                <li key={s.category.id}>
                  <button
                    type="button"
                    onClick={() => scrollToCategory(s.category.id)}
                    className="w-full rounded px-2 py-1.5 text-left text-white active:bg-white/15"
                  >
                    {s.category.name}{" "}
                    <span className="opacity-70">({s.items.length})</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">
        {loading && items.length === 0 && (
          <p className="px-3 py-12 text-center text-sm text-neutral-500">
            Carico la lista…
          </p>
        )}

        {showEmptyState && (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-neutral-600">
              {error
                ? "Impossibile contattare il server."
                : "Nessun dato disponibile."}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded bg-brand px-4 py-2 text-sm font-medium text-white shadow"
            >
              Riprova
            </button>
          </div>
        )}

        {!showEmptyState && filteredSections.length === 0 && items.length > 0 && (
          <p className="px-3 py-12 text-center text-sm text-neutral-500">
            Nessun titolo trovato.
          </p>
        )}

        {filteredSections.map((s) => (
          <section
            key={s.category.id}
            ref={(el) => {
              sectionRefs.current[s.category.id] = el;
            }}
            className="mb-6 scroll-mt-28"
          >
            <h2 className="-mx-3 mb-2 bg-brand-dark px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
              {s.category.name}{" "}
              <span className="font-normal opacity-80">
                ({s.items.length})
              </span>
            </h2>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-white shadow-sm">
              {s.items.map((it) => (
                <GameRow
                  key={it.id}
                  item={it}
                  selected={selections[it.id] ?? {}}
                  hydrated={hydrated}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
