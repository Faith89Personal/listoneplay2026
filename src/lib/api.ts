import type { Item, Vote } from "@/types";

const UPSTREAM = "https://list.giochisulnostrotavolo.it/be/public/api";
const REVALIDATE_SECONDS = 600;

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${UPSTREAM}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[api] upstream ${path} responded ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] fetch ${path} failed:`, (err as Error).message);
    return fallback;
  }
}

export function getItems(): Promise<Item[]> {
  return fetchJson<Item[]>("/items", []);
}

export function getVotes(): Promise<Vote[]> {
  return fetchJson<Vote[]>("/votes", []);
}

export function countVotesByItem(votes: Vote[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const v of votes) {
    counts.set(v.id.idItem, (counts.get(v.id.idItem) ?? 0) + 1);
  }
  return counts;
}
