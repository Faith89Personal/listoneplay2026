"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export type Play = {
  itemId: number;
  rating: number;
  note: string | null;
  playedAt: string;
  bought: boolean;
};

export type PlaysState = {
  plays: Play[];
  loading: boolean;
  error: string | null;
};

type Listener = (s: PlaysState) => void;

let cache: PlaysState = {
  plays: [],
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: PlaysState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<PlaysState> {
  try {
    const res = await fetch("/api/plays", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return { plays: [], loading: false, error: null };
      }
      return { plays: [], loading: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { plays: Play[] };
    return { plays: data.plays, loading: false, error: null };
  } catch (err) {
    return { plays: [], loading: false, error: (err as Error).message };
  }
}

export function usePlays() {
  const session = useSession();
  const [state, setState] = useState<PlaysState>(cache);

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
      setShared({ plays: [], loading: false, error: null });
      return;
    }
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [session.loading, session.email]);

  const save = useCallback(
    async (p: {
      itemId: number;
      rating: number;
      note: string | null;
      bought: boolean;
    }) => {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `http_${res.status}`);
      }
      const fresh = await load();
      setShared(fresh);
    },
    [],
  );

  const remove = useCallback(async (itemId: number) => {
    const res = await fetch(`/api/plays?itemId=${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `http_${res.status}`);
    }
    const fresh = await load();
    setShared(fresh);
  }, []);

  return { ...state, save, remove, loggedIn: !!session.email };
}
