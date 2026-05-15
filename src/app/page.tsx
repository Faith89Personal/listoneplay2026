import { getItems } from "@/lib/api";
import GameList from "@/components/GameList";
import Legend from "@/components/Legend";

export const revalidate = 600;

export default async function Home() {
  const items = await getItems();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold text-brand-dark">
          Listone Play 2026
        </h1>
        <p className="text-sm text-neutral-600">
          Lista non disponibile in questo momento. Riprova tra qualche minuto.
        </p>
      </main>
    );
  }

  return (
    <>
      <GameList items={items} />
      <Legend />
      <footer className="mx-auto mt-8 max-w-2xl px-3 pb-10 text-center text-xs text-neutral-500">
        Dati: list.giochisulnostrotavolo.it · clone per uso personale
      </footer>
    </>
  );
}
