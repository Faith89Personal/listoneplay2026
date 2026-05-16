"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { EditorsSnapshot, Item } from "@/types";
import { useSelections, type Selections } from "@/lib/storage";
import { useItems } from "@/lib/useItems";
import { useReservations, type Reservation } from "@/lib/useReservations";
import { EVENT_DAYS, utcIsoToRomeParts } from "@/lib/eventDays";
import { useManualEvents } from "@/lib/useManualEvents";
import { usePlays, type Play } from "@/lib/usePlays";
import { useManualItems, type ManualItem } from "@/lib/useManualItems";
import { useRushes } from "@/lib/useRushes";
import {
  type CalendarBlock,
  manualToBlock,
  reservationToBlock,
} from "@/lib/calendarBlocks";
import GameRow from "@/components/GameRow";
import AuthBar from "@/components/AuthBar";
import ReservationModal from "@/components/ReservationModal";
import PlayedModal from "@/components/PlayedModal";
import ManualItemModal from "@/components/ManualItemModal";
import RushModal from "@/components/RushModal";
import ThemePicker from "@/components/ThemePicker";
import InstallHint from "@/components/InstallHint";
import NotificationsHint from "@/components/NotificationsHint";
import {
  SearchIcon,
  CloseIcon,
  MenuIcon,
  LookIcon,
  PlayIcon,
  CalendarIcon,
  StarIcon,
  AlarmIcon,
} from "@/components/icons";

type EditorGroup = {
  editorName: string;
  stands: string[];
  items: Item[];
};
type Section = {
  category: { id: number; name: string; ordering: number };
  editorGroups: EditorGroup[];
};

type Filter = "look" | "play" | "reserved" | "played";

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
  filters: Set<Filter>,
  selections: Selections,
  reservationByItem: Map<number, Reservation>,
  playByItem: Map<number, Play>,
): Section[] {
  const q = normalize(query.trim());
  const matches = (it: Item, f: Filter) => {
    if (f === "reserved") return reservationByItem.has(it.id);
    if (f === "played") return playByItem.has(it.id);
    return selections[it.id]?.[f] === "checked";
  };
  const passesFilter = (it: Item) => {
    if (filters.size === 0) return true;
    for (const f of filters) if (matches(it, f)) return true;
    return false;
  };
  return sections
    .map((s) => {
      const editorGroups = s.editorGroups
        .map((g) => {
          const editorMatches = q ? normalize(g.editorName).includes(q) : true;
          const items = g.items.filter((it) => {
            if (!passesFilter(it)) return false;
            if (!q) return true;
            if (editorMatches) return true;
            return normalize(it.name).includes(q);
          });
          return items.length > 0 ? { ...g, items } : null;
        })
        .filter((g): g is EditorGroup => g !== null);
      return editorGroups.length > 0 ? { ...s, editorGroups } : null;
    })
    .filter((s): s is Section => s !== null);
}

function ColumnHeader() {
  return (
    <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 text-neutral-400">
      <div className="flex h-6 w-7 items-center justify-center">
        <LookIcon className="h-4 w-4" />
      </div>
      <div className="flex h-6 w-7 items-center justify-center">
        <PlayIcon className="h-4 w-4" />
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
        "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
        (active
          ? "bg-white text-brand-dark shadow-sm"
          : "bg-white/15 text-white active:bg-white/25")
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
  const manualItemsState = useManualItems();
  const rushesState = useRushes();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const toggleFilter = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  const [reservingItem, setReservingItem] = useState<Item | null>(null);
  const [ratingItem, setRatingItem] = useState<Item | null>(null);
  const [rushingItem, setRushingItem] = useState<Item | null>(null);
  const [editingManual, setEditingManual] = useState<ManualItem | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);
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

  const rushDaysByItem = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const r of rushesState.rushes) {
      const list = m.get(r.itemId) ?? [];
      list.push(r.day);
      m.set(r.itemId, list);
    }
    return m;
  }, [rushesState.rushes]);

  const morningRushBanner = useMemo(() => {
    if (!rushesState.loggedIn) return null;
    const nowRome = utcIsoToRomeParts(new Date().toISOString());
    const isEventDay = EVENT_DAYS.some((d) => d.date === nowRome.date);
    if (!isEventDay) return null;
    if (nowRome.hour >= 11) return null;
    const todayRushes = rushesState.rushes.filter(
      (r) => r.day === nowRome.date,
    );
    if (todayRushes.length === 0) return null;
    return { count: todayRushes.length };
  }, [rushesState.rushes, rushesState.loggedIn]);

  const catalogItems = data?.items ?? [];
  const items = useMemo(
    () => [...catalogItems, ...manualItemsState.asItems],
    [catalogItems, manualItemsState.asItems],
  );
  const editorsSnap: EditorsSnapshot = data?.editors ?? {
    source: "",
    generatedAt: "",
    editors: {},
  };
  const manualItemById = useMemo(() => {
    const m = new Map<number, ManualItem>();
    for (const it of manualItemsState.items) m.set(it.id, it);
    return m;
  }, [manualItemsState.items]);

  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const allBlocks: CalendarBlock[] = useMemo(() => {
    const editorStands = editorsSnap.editors ?? {};
    const r = reservationsState.reservations.map((res) => {
      const it = itemsById.get(res.itemId) ?? null;
      const stands = it ? (editorStands[it.editor.name]?.stands ?? []) : [];
      return reservationToBlock(res, it, stands);
    });
    const m = manualState.events.map(manualToBlock);
    return [...r, ...m];
  }, [reservationsState.reservations, manualState.events, itemsById, editorsSnap]);

  const sections = useMemo(
    () => buildSections(items, editorsSnap),
    [items, editorsSnap],
  );
  const filteredSections = useMemo(
    () =>
      filterSections(
        sections,
        query,
        filters,
        selections,
        reservationByItem,
        playByItem,
      ),
    [sections, query, filters, selections, reservationByItem, playByItem],
  );

  function scrollToCategory(id: number) {
    setMenuOpen(false);
    const el = sectionRefs.current[id];
    if (el) {
      const header = document.getElementById("app-header");
      const offset = (header?.offsetHeight ?? 0) + 8;
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
        className="sticky top-0 z-30 bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pt-2.5 pb-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Apri menu categorie"
            className="rounded-md p-1.5 active:bg-white/15"
          >
            {menuOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-base font-bold tracking-tight">
              Listone Play 2026
            </span>
            {stale && (
              <span className="text-[10px] opacity-70">offline · cache</span>
            )}
          </div>
          {reservationsState.loggedIn && (
            <>
              <button
                type="button"
                onClick={() => setCreatingManual(true)}
                aria-label="Aggiungi gioco manuale"
                className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <Link
                href="/rush"
                aria-label="Rush mattina"
                className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
              >
                <AlarmIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/giocati"
                aria-label="Giocati e votati"
                className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
              >
                <StarIcon filled className="h-4 w-4" />
              </Link>
              <Link
                href="/prenotazioni"
                aria-label="Le mie prenotazioni"
                className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
              >
                <CalendarIcon className="h-4 w-4" />
              </Link>
            </>
          )}
          <ThemePicker />
          <a
            href={MAP_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Apri mappa Play 2026"
            className="flex items-center justify-center rounded-md bg-white/15 p-1.5 active:bg-white/25"
          >
            <MapPinIcon className="h-4 w-4" />
          </a>
        </div>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pb-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-neutral-700 shadow-inner">
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
        <div className="mx-auto flex max-w-2xl items-center gap-1.5 overflow-x-auto px-3 pb-3">
          <FilterChip
            active={filters.size === 0}
            onClick={() => setFilters(new Set())}
          >
            Tutti
          </FilterChip>
          <FilterChip
            active={filters.has("look")}
            onClick={() => toggleFilter("look")}
          >
            <LookIcon className="h-3.5 w-3.5" />
            <span>Occhio</span>
          </FilterChip>
          <FilterChip
            active={filters.has("play")}
            onClick={() => toggleFilter("play")}
          >
            <PlayIcon className="h-3.5 w-3.5" />
            <span>Provare</span>
          </FilterChip>
          {reservationsState.loggedIn && (
            <>
              <FilterChip
                active={filters.has("reserved")}
                onClick={() => toggleFilter("reserved")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Prenotati</span>
              </FilterChip>
              <FilterChip
                active={filters.has("played")}
                onClick={() => toggleFilter("played")}
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
                    className="w-full rounded-md px-2 py-1.5 text-left text-white active:bg-white/15"
                  >
                    {s.category.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-4">
        <InstallHint />
        <NotificationsHint />
        {morningRushBanner && (
          <Link
            href="/rush"
            className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-100 px-3 py-2.5 text-sm text-amber-900 shadow-sm ring-1 ring-amber-300 active:bg-amber-200"
          >
            <AlarmIcon className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="flex-1 leading-tight">
              <span className="font-bold">
                {morningRushBanner.count}{" "}
                {morningRushBanner.count === 1 ? "stand" : "stand"} da
                raggiungere stamattina.
              </span>{" "}
              Apri la lista rush.
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </Link>
        )}
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
              className="mt-3 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow"
            >
              Riprova
            </button>
          </div>
        )}

        {noResults && (
          <p className="px-3 py-12 text-center text-sm text-neutral-500">
            {filters.size > 0
              ? "Nessun titolo per i filtri selezionati."
              : "Nessun titolo trovato."}
          </p>
        )}

        {filteredSections.map((s) => (
          <section
            key={s.category.id}
            ref={(el) => {
              sectionRefs.current[s.category.id] = el;
            }}
            className="mb-6 scroll-mt-44"
          >
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-300" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-dark">
                {s.category.name}
              </h2>
              <div className="h-px flex-1 bg-neutral-300" />
            </div>

            <div className="space-y-3">
              {s.editorGroups.map((g) => (
                <article
                  key={g.editorName}
                  className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-neutral-200"
                >
                  <header className="flex items-stretch gap-3 border-b border-neutral-200 bg-brand-tint pr-3">
                    <div className="w-1.5 shrink-0 bg-brand" aria-hidden />
                    <div className="flex flex-1 items-center gap-2 py-2.5">
                      <h3 className="flex-1 text-[15px] font-bold tracking-tight text-neutral-900">
                        {g.editorName}
                      </h3>
                      {g.stands.length > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                          <MapPinIcon className="h-3 w-3" />
                          {g.stands.join("·")}
                        </span>
                      )}
                    </div>
                  </header>
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
                        onEditManual={(id) => {
                          const mi = manualItemById.get(id);
                          if (mi) setEditingManual(mi);
                        }}
                        rushDays={rushDaysByItem.get(it.id) ?? []}
                        canRush={rushesState.loggedIn}
                        onRush={(item) => setRushingItem(item)}
                      />
                    ))}
                  </ul>
                </article>
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
          stand={(() => {
            const ed = editorsSnap.editors[reservingItem.editor.name];
            return ed?.stands?.join("·") ?? null;
          })()}
          editorName={reservingItem.editor.name || null}
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
      {editingManual && (
        <ManualItemModal
          existing={editingManual}
          onClose={() => setEditingManual(null)}
        />
      )}
      {creatingManual && (
        <ManualItemModal
          existing={null}
          onClose={() => setCreatingManual(false)}
        />
      )}
      {rushingItem && (
        <RushModal
          item={rushingItem}
          stand={(() => {
            const ed = editorsSnap.editors[rushingItem.editor.name];
            return ed?.stands?.join("·") ?? null;
          })()}
          onClose={() => setRushingItem(null)}
        />
      )}
    </>
  );
}
