import type { Item } from "@/types";
import type { SelectionFlag } from "@/lib/storage";
import { ForbiddenIcon } from "@/components/icons";

type CellProps = {
  active: boolean;
  enabled: boolean;
  onToggle: () => void;
  label: string;
};

function Cell({ active, enabled, onToggle, label }: CellProps) {
  if (!enabled) {
    return (
      <div className="flex h-7 w-7 items-center justify-center bg-brand-soft text-neutral-400">
        <ForbiddenIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onToggle}
      className="flex h-7 w-7 items-center justify-center bg-brand-soft active:bg-brand-soft/80"
    >
      <span
        className={
          active
            ? "flex h-4 w-4 items-center justify-center rounded-sm border-2 border-brand-dark bg-brand-dark text-white"
            : "h-4 w-4 rounded-sm border-2 border-brand-dark bg-white"
        }
      >
        {active && (
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
        )}
      </span>
    </button>
  );
}

type GameRowProps = {
  item: Item;
  selected: Partial<Record<SelectionFlag, true>>;
  hydrated: boolean;
  onToggle: (itemId: number, flag: SelectionFlag) => void;
};

export default function GameRow({
  item,
  selected,
  hydrated,
  onToggle,
}: GameRowProps) {
  const thirdCellIsLetter = Boolean(item.bookType);

  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <Cell
        active={hydrated && !!selected.look}
        enabled={item.isAvailable}
        onToggle={() => onToggle(item.id, "look")}
        label={`Mi interessa ${item.name}`}
      />
      <Cell
        active={hydrated && !!selected.play}
        enabled={item.isPlayable}
        onToggle={() => onToggle(item.id, "play")}
        label={`Voglio provare ${item.name}`}
      />
      {thirdCellIsLetter ? (
        <div className="flex h-7 w-7 items-center justify-center bg-brand-soft font-bold leading-none">
          {item.bookType}
        </div>
      ) : (
        <Cell
          active={hydrated && !!selected.buy}
          enabled={item.isBuyable}
          onToggle={() => onToggle(item.id, "buy")}
          label={`Voglio comprare ${item.name}`}
        />
      )}

      <div className="flex flex-1 flex-col leading-tight">
        <span className="font-medium">{item.name}</span>
        <span className="text-xs text-neutral-500">{item.editor.name}</span>
      </div>
    </li>
  );
}
