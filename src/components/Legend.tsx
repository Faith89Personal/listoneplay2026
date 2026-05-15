import { LookIcon, PlayIcon, BuyIcon, ForbiddenIcon } from "@/components/icons";

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
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-soft">
            <BuyIcon className="h-4 w-4 text-brand-dark" />
          </span>
          <span>Questo torna a casa con me</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-neutral-100">
            <ForbiddenIcon className="h-4 w-4 text-neutral-500" />
          </span>
          <span>Non provabile o comprabile</span>
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
