import { LookIcon, PlayIcon, BuyIcon, ForbiddenIcon } from "@/components/icons";

export default function Legend() {
  return (
    <section className="mx-auto mt-6 max-w-2xl px-3">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-dark">
        Legenda
      </h3>
      <ul className="space-y-1.5 rounded-lg bg-white p-3 text-sm shadow-sm">
        <li className="flex items-center gap-2">
          <LookIcon className="h-5 w-5 text-brand-dark" />
          <span>Vorrei almeno buttarci un occhio</span>
        </li>
        <li className="flex items-center gap-2">
          <PlayIcon className="h-5 w-5 text-brand-dark" />
          <span>Voglio farci una partita in Fiera</span>
        </li>
        <li className="flex items-center gap-2">
          <BuyIcon className="h-5 w-5 text-brand-dark" />
          <span>Questo torna a casa con me</span>
        </li>
        <li className="flex items-center gap-2">
          <ForbiddenIcon className="h-5 w-5 text-neutral-400" />
          <span>Il titolo non è provabile o comprabile</span>
        </li>
        <li className="flex gap-2 pt-1 text-xs text-neutral-600">
          <span className="font-bold">L</span>
          <span>= Librogame</span>
          <span className="ml-3 font-bold">G</span>
          <span>= Fumetto game</span>
        </li>
      </ul>
    </section>
  );
}
