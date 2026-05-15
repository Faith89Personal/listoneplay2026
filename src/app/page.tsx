import { getItems, getVotes, countVotesByItem } from "@/lib/api";
import type { Item } from "@/types";

export const revalidate = 600;

function groupByCategory(items: Item[]): Map<string, Item[]> {
  const sorted = [...items].sort((a, b) => {
    if (a.category.ordering !== b.category.ordering) {
      return a.category.ordering - b.category.ordering;
    }
    return a.name.localeCompare(b.name, "it");
  });
  const groups = new Map<string, Item[]>();
  for (const item of sorted) {
    const key = item.category.name;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

export default async function Home() {
  const [items, votes] = await Promise.all([getItems(), getVotes()]);
  const voteCounts = countVotesByItem(votes);
  const groups = groupByCategory(items);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">
          Listone Play 2026
        </h1>
        <p className="text-sm text-neutral-600">
          {items.length > 0
            ? `${items.length} titoli · aggiornato dall'API di GSNT`
            : "Dati non disponibili in questo momento"}
        </p>
      </header>

      {[...groups.entries()].map(([categoryName, list]) => (
        <section key={categoryName} className="mb-8">
          <h2 className="sticky top-0 z-10 -mx-4 mb-2 bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow">
            {categoryName}{" "}
            <span className="font-normal opacity-80">({list.length})</span>
          </h2>
          <ul className="divide-y divide-neutral-200 rounded-lg bg-white shadow-sm">
            {list.map((item) => {
              const votes = voteCounts.get(item.id) ?? 0;
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium leading-tight">
                      {item.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {item.editor.name}
                    </span>
                  </div>
                  {item.bookType && (
                    <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-bold">
                      {item.bookType}
                    </span>
                  )}
                  {votes > 0 && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                      {votes}
                    </span>
                  )}
                  {!item.isAvailable && (
                    <span className="text-xs text-red-500">N/D</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
