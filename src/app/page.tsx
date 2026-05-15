import GameList from "@/components/GameList";
import Legend from "@/components/Legend";

export default function Home() {
  return (
    <>
      <GameList />
      <Legend />
      <footer className="mx-auto mt-8 max-w-2xl px-3 pb-10 text-center text-xs text-neutral-500">
        Dati: list.giochisulnostrotavolo.it · clone per uso personale
      </footer>
    </>
  );
}
