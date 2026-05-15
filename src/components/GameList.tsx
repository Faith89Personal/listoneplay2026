"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { EditorsSnapshot, Item } from "@/types";
import { useSelections, type Selections } from "@/lib/storage";
import { useItems } from "@/lib/useItems";
import { useReservations, type Reservation } from "@/lib/useReservations";
import { useManualEvents } from "@/lib/useManualEvents";
import { usePlays, type Play } from "@/lib/usePlays";
import {
  type CalendarBlock,
  manualToBlock,
  reservationToBlock,
} from "@/lib/calendarBlocks";
import GameRow from "@/components/GameRow";
import AuthBar from "@/components/AuthBar";
import ReservationModal from "@/components/ReservationModal";
import PlayedModal from "@/components/PlayedModal";
import {
  SearchIcon,
  CloseIcon,
  MenuIcon,
  LookIcon,
  PlayIcon,
  BuyIcon,
  CalendarIcon,
  StarIcon,
} from "@/components/icons";

type EditorGroup = {
  editorName: string;
  stands: string[];
  items: Item[];
};
type Section = {
  category: { id: number; name: string; ordering: number };
  editorGroups: EditorGroup[];
  total: number;
};

type Filter = "all" | "look" | "play" | "buy" | "reserved" | "played";

const MAP_PDF_URL = "/Mappa-Play-2026.pdf";

function buildSections(
  items: Item[],
  editorsSnap: EditorsSnapshot,
): Section[] {
  const byCat = new Map<number, Section>();
  for (const item of items) {
    let s = byCat.get(item.category.id);
    if (!s) {
      s = {
        category: {
          id: item.category.id,
          name: item.category.name,
          ordering: item.category.ordering,
        },
        editorGroups: [],
        total: 0,
      };
      byCat.set(item.category.id, s);
    }
    let g = s.editorGroups.find((eg) => eg.editorName === item.editor.name);
    if (!g) {
      const info = editorsSnap.editors[item.editor.name];
      g = {
        editorName: item.editor.name,
        stands: info?.stands ?? [],
        items: [],
      };
      s.editorGroups.push(g);
    }
    g.items.push(item);
    s.total += 1;
  }
  for (const s of byCat.values()) {
    for (const g of s.editorGroups) {
      g.items.sort((a, b) => a.name.localeCompare(b.name, "it"));
    }
    s.editorGroups.sort((a, b) =>
      a.editorName.localeCompare(b.editorName, "it"),
    );
  }
  return [...byCat.values()].sort(
    (a, b) => a.category.ordering - b.category.ordering,
  );
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function filterSections(
  sections: Section[],
  query: string,
  filter: Filter,
  selections: Selections,
  reservationByItem: Map<number, Reservation>,
  playByItem: Map<number, Play>,
): Section[] {
  const q = normalize(query.trim());
  const passesFilter = (it: Item) => {
    if (filter === "all") return true;
    if (filter === "reserved") return reservationByItem.has(it.id);
    if (filter === "played") return playByItem.has(it.id);
    return selections[it.id]?.[filter] === "checked";
  };
  return sections
    .map((s) => {
      const editorGroups = s.editorGroups
        .map((g) => {
          const editorMatches = q
            ? normalize(g.editorName).includes(q)
            : true;
          const items = g.items.filter((it) => {
            if (!passesFilter(it)) return false;
            if (!q) return true;
            if (editorMatches) return true;
            return normalize(it.name).includes(q);
          });
          return items.length > 0 ? { ...g, items } : null;
        })
        .filter((g): g is EditorGroup => g !== null);
      const total = editorGroups.reduce((n, g) => n + g.items.length, 0);
      return total > 0 ? { ...s, editorGroups, total } : null;
    })
    .filter((s): s is Section => s !== null);
}

function ColumnHeader() {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-1">
      <div className="flex h-6 w-7 items-center justify-center">
        <LookIcon className="h-4 w-4 text-brand-dark" />
      </div>
      <div className="flex h-6 w-7 items-center justify-center">
        <PlayIcon className="h-4 w-4 text-brand-dark" />
      </div>
      <div className="flex h-6 w-7 items-center justify-center">
        <BuyIcon className="h-4 w-4 text-brand-dark" />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-white bg-white text-brand-dark"
          : "border-white/40 bg-transparent text-white active:bg-white/15")
      }
    >
      {children}
    </button>
  );
}

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export default function GameList() {
  const { data, loading, error, stale, refresh } = useItems();
  const { selections, cycle, hydrated } = useSelections();
  const reservationsState = useReservations();
  const manualState = useManualEvents();
  const playsState = usePlays();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [reservingItem, setReservingItem] = useState<Item | null>(null);
  const [ratingItem, setRatingItem] = useState<Item | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const reservationByItem = useMemo(() => {
    const m = new Map<number, Reservation>();
    for (const r of reservationsState.reservations) m.set(r.itemId, r);
    return m;
  }, [reservationsState.reservations]);

  const playByItem = useMemo(() => {
    const m = new Map<number, Play>();
    for (const p of playsState.plays) m.set(p.itemId, p);
    return m;
  }, [playsState.plays]);

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of data?.items ?? []) m.set(it.id, it);
    return m;
  }, [data]);

  const allBlocks: CalendarBlock[] = useMemo(() => {
    const editorStands = data?.editors.editors ?? {};
    const r = reservationsState.reservations.map((res) => {
      const it = itemsById.get(res.itemId) ?? null;
      const stands = it ? (editorStands[it.editor.name]?.stands ?? []) : [];
      return reservationToBlock(res, it, stands);
    });
    const m = manualState.events.map(manualToBlock);
    return [...r, ...m];
  }, [reservationsState.reservations, manualState.events, itemsById, data]);

  const items = data?.items ?? [];
  const editorsSnap: EditorsSnapshot = data?.editors ?? {
    source: "",
    generatedAt: "",
    editors: {},
  };

  const sections = useMemo(
    () => buildSections(items, editorsSnap),
    [items, editorsSnap],
  );
  const filteredSections = useMemo(
    () =>
      filterSections(
        sections,
        query,
        filter,
        selections,
        reservationByItem,
        playByItem,
      ),
    [sections, query, filter, selections, reservationByItem, playByItem],
  );

  const totalShown = filteredSections.reduce((n, s) => n + s.total, 0);
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
  const noResults =
    !showEmptyState && filteredSections.length === 0 && items.length > 0;

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
          {reservationsState.loggedIn && (
            <Link
              href="/prenotazioni"
              aria-label="Le mie prenotazioni"
              className="flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-xs font-medium active:bg-white/25"
            >
              <CalendarIcon className="h-4 w-4" />
            </Link>
          )}
          <a
            href={MAP_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Apri mappa Play 2026"
            className="flex items-center gap-1 rounded bg-white/15 px-2 py-1 text-xs font-medium active:bg-white/25"
          >
            <MapPinIcon className="h-4 w-4" />
          </a>
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
        <AuthBar />
        <div className="mx-auto flex max-w-2xl items-center gap-1.5 overflow-x-auto px-3 pb-2">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Tutti
          </FilterChip>
          <FilterChip
            active={filter === "look"}
            onClick={() => setFilter("look")}
          >
            <LookIcon className="h-3.5 w-3.5" />
            <span>Occhio</span>
          </FilterChip>
          <FilterChip
            active={filter === "play"}
            onClick={() => setFilter("play")}
          >
            <PlayIcon className="h-3.5 w-3.5" />
            <span>Provare</span>
          </FilterChip>
          <FilterChip
            active={filter === "buy"}
            onClick={() => setFilter("buy")}
          >
            <BuyIcon className="h-3.5 w-3.5" />
            <span>Comprare</span>
          </FilterChip>
          {reservationsState.loggedIn && (
            <>
              <FilterChip
                active={filter === "reserved"}
                onClick={() => setFilter("reserved")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Prenotati</span>
              </FilterChip>
              <FilterChip
                active={filter === "played"}
                onClick={() => setFilter("played")}
              >
                <StarIcon filled className="h-3.5 w-3.5" />
                <span>Giocati</span>
              </FilterChip>
            </>
          )}
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
                    <span className="opacity-70">({s.total})</span>
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

        {noResults && (
          <p className="px-3 py-12 text-center text-sm text-neutral-500">
            {filter === "reserved"
              ? "Nessun gioco prenotato."
              : filter === "played"
                ? "Nessun gioco giocato."
                : filter !== "all"
                  ? "Nessun titolo selezionato per questo filtro."
                  : "Nessun titolo trovato."}
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
              <span className="font-normal opacity-80">({s.total})</span>
            </h2>

            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
              {s.editorGroups.map((g, idx) => (
                <div key={g.editorName}>
                  <div
                    className={
                      "flex items-baseline justify-between gap-2 bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-700" +
                      (idx > 0 ? " border-t border-neutral-200" : "")
                    }
                  >
                    <span className="flex-1">
                      {g.editorName}{" "}
                      <span className="font-normal text-neutral-500">
                        ({g.items.length})
                      </span>
                    </span>
                    {g.stands.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-brand-dark">
                        <MapPinIcon className="h-3 w-3" />
                        {g.stands.join(" · ")}
                      </span>
                    )}
                  </div>
                  <ColumnHeader />
                  <ul className="divide-y divide-neutral-100">
                    {g.items.map((it) => (
                      <GameRow
                        key={it.id}
                        item={it}
                        selected={selections[it.id] ?? {}}
                        hydrated={hydrated}
                        onCycle={cycle}
                        reservation={reservationByItem.get(it.id) ?? null}
                        canReserve={reservationsState.loggedIn}
                        onReserve={(item) => setReservingItem(item)}
                        play={playByItem.get(it.id) ?? null}
                        canRate={playsState.loggedIn}
                        onRate={(item) => setRatingItem(item)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {reservingItem && (
        <ReservationModal
          item={reservingItem}
          existing={reservationByItem.get(reservingItem.id) ?? null}
          allBlocks={allBlocks}
          onClose={() => setReservingItem(null)}
        />
      )}
      {ratingItem && (
        <PlayedModal
          item={ratingItem}
          existing={playByItem.get(ratingItem.id) ?? null}
          onClose={() => setRatingItem(null)}
        />
      )}
    </>
  );
}
