import type { Item } from "@/types";
import type { CellState, SelectionFlag } from "@/lib/storage";
import { ForbiddenIcon } from "@/components/icons";

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
};

const BOOKTYPE_LABEL: Record<string, string> = {
  L: "Librogame",
  G: "Fumetto game",
  F: "Fumetto",
  E: "Enciclopedia",
};

export default function GameRow({
  item,
  selected,
  hydrated,
  onCycle,
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
              className="ml-1.5 inline-block rounded bg-brand-soft px-1 text-[10px] font-bold leading-snug align-middle"
            >
              {item.bookType}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}
