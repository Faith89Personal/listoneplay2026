import type { Item } from "@/types";
import type { CellState, SelectionFlag } from "@/lib/storage";
import type { Reservation } from "@/lib/useReservations";
import type { Play } from "@/lib/usePlays";
import { formatRangeShort } from "@/lib/eventDays";
import { CalendarIcon, ForbiddenIcon, StarIcon } from "@/components/icons";

type CellProps = {
  state: CellState | undefined;
  onClick: () => void;
  label: string;
};

function Cell({ state, onClick, label }: CellProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center bg-brand-soft active:bg-brand-soft/70"
    >
      {state === "checked" && (
        <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-brand-dark bg-brand-dark text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3 8.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      {state === "forbidden" && (
        <ForbiddenIcon className="h-4 w-4 text-neutral-700" />
      )}
      {state === undefined && (
        <span className="h-4 w-4 rounded-sm border-2 border-brand-dark bg-white" />
      )}
    </button>
  );
}

type GameRowProps = {
  item: Item;
  selected: Partial<Record<SelectionFlag, CellState>>;
  hydrated: boolean;
  onCycle: (itemId: number, flag: SelectionFlag) => void;
  reservation: Reservation | null;
  canReserve: boolean;
  onReserve: (item: Item) => void;
  play: Play | null;
  canRate: boolean;
  onRate: (item: Item) => void;
};

const BOOKTYPE_LABEL: Record<string, string> = {
  L: "Librogame",
  G: "Fumetto game",
  F: "Fumetto",
  E: "Enciclopedia",
};

function bggUrl(idBgg: number): string {
  return `https://boardgamegeek.com/boardgame/${idBgg}`;
}

export default function GameRow({
  item,
  selected,
  hydrated,
  onCycle,
  reservation,
  canReserve,
  onReserve,
  play,
  canRate,
  onRate,
}: GameRowProps) {
  const stateFor = (flag: SelectionFlag): CellState | undefined =>
    hydrated ? selected[flag] : undefined;

  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <Cell
        state={stateFor("look")}
        onClick={() => onCycle(item.id, "look")}
        label={`Occhio: ${item.name}`}
      />
      <Cell
        state={stateFor("play")}
        onClick={() => onCycle(item.id, "play")}
        label={`Provare in fiera: ${item.name}`}
      />
      <Cell
        state={stateFor("buy")}
        onClick={() => onCycle(item.id, "buy")}
        label={`Comprare: ${item.name}`}
      />

      <div className="flex flex-1 flex-col leading-tight">
        <span className="font-medium">
          {item.name}
          {item.bookType && (
            <span
              title={BOOKTYPE_LABEL[item.bookType] ?? item.bookType}
              className="ml-1.5 inline-block rounded bg-brand-soft px-1 align-middle text-[10px] font-bold leading-snug"
            >
              {item.bookType}
            </span>
          )}
          {item.idBgg && (
            <a
              href={bggUrl(item.idBgg)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Apri scheda BGG"
              className="ml-1.5 inline-block rounded bg-orange-500 px-1 align-middle text-[9px] font-bold leading-snug text-white"
            >
              BGG
            </a>
          )}
        </span>
        {reservation && (
          <span className="text-[10px] font-medium text-brand-dark">
            📅 {formatRangeShort(reservation.reservedAt, reservation.durationMinutes)}
            {reservation.note ? ` · ${reservation.note}` : ""}
          </span>
        )}
        {play && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
            <StarIcon filled className="h-3 w-3" />
            {play.rating}/5
            {play.note ? <span className="text-neutral-500">· {play.note}</span> : null}
          </span>
        )}
      </div>

      {canRate && (
        <button
          type="button"
          aria-label={play ? `Modifica voto ${item.name}` : `Vota ${item.name}`}
          onClick={() => onRate(item)}
          className={
            "flex h-7 w-7 items-center justify-center rounded " +
            (play
              ? "bg-amber-500 text-white"
              : "bg-neutral-100 text-neutral-500 active:bg-neutral-200")
          }
        >
          <StarIcon filled={!!play} className="h-4 w-4" />
        </button>
      )}

      {canReserve && (
        <button
          type="button"
          aria-label={
            reservation ? `Modifica prenotazione ${item.name}` : `Prenota ${item.name}`
          }
          onClick={() => onReserve(item)}
          className={
            "flex h-7 w-7 items-center justify-center rounded " +
            (reservation
              ? "bg-brand-dark text-white"
              : "bg-neutral-100 text-neutral-600 active:bg-neutral-200")
          }
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
