"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export type Rush = { itemId: number; day: string };

export type RushesState = {
  rushes: Rush[];
  loading: boolean;
  error: string | null;
};

type Listener = (s: RushesState) => void;

let cache: RushesState = {
  rushes: [],
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: RushesState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<RushesState> {
  try {
    const res = await fetch("/api/rushes", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return { rushes: [], loading: false, error: null };
      }
      return { rushes: [], loading: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { rushes: Rush[] };
    return { rushes: data.rushes, loading: false, error: null };
  } catch (err) {
    return { rushes: [], loading: false, error: (err as Error).message };
  }
}

export function useRushes() {
  const session = useSession();
  const [state, setState] = useState<RushesState>(cache);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!session.email) {
      cachedForEmail = null;
      setShared({ rushes: [], loading: false, error: null });
      return;
    }
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [session.loading, session.email]);

  const toggle = useCallback(
    async (itemId: number, day: string, currentlyOn: boolean) => {
      // Optimistic update
      setShared({
        ...cache,
        rushes: currentlyOn
          ? cache.rushes.filter((r) => !(r.itemId === itemId && r.day === day))
          : [...cache.rushes, { itemId, day }],
      });
      try {
        if (currentlyOn) {
          await fetch(`/api/rushes?itemId=${itemId}&day=${day}`, {
            method: "DELETE",
          });
        } else {
          await fetch("/api/rushes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, day }),
          });
        }
      } catch {
        // best-effort; reload to be safe
        load().then(setShared);
      }
    },
    [],
  );

  return { ...state, toggle, loggedIn: !!session.email };
}
