import { LookIcon, PlayIcon, ForbiddenIcon } from "@/components/icons";

export default function Legend() {
  return (
    <section className="mx-auto mt-8 max-w-2xl px-3">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-dark">
        Legenda
      </h3>
      <ul className="space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-neutral-100">
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-soft">
            <LookIcon className="h-4 w-4 text-brand-dark" />
          </span>
          <span>Vorrei almeno buttarci un occhio</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-soft">
            <PlayIcon className="h-4 w-4 text-brand-dark" />
          </span>
          <span>Voglio farci una partita in fiera</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-neutral-100">
            <ForbiddenIcon className="h-4 w-4 text-neutral-500" />
          </span>
          <span>Non provabile</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 items-center justify-center rounded bg-brand px-1.5 text-[10px] font-bold text-white">
            BGG
          </span>
          <span>Scheda BoardGameGeek diretta</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded border border-amber-400 bg-amber-50">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-amber-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </span>
          <span>Ricerca su BoardGameGeek (nessun match diretto)</span>
        </li>
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-brand-soft px-1 text-[10px] font-bold">L</span>
            Librogame
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-brand-soft px-1 text-[10px] font-bold">G</span>
            Fumetto game
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-brand-soft px-1 text-[10px] font-bold">F</span>
            Fumetto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-brand-soft px-1 text-[10px] font-bold">E</span>
            Enciclopedia
          </span>
        </li>
      </ul>
    </section>
  );
}
