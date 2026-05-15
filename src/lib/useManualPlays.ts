"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export type ManualPlay = {
  id: number;
  name: string;
  editor: string | null;
  rating: number;
  playedOn: string | null;
  note: string | null;
};

export type ManualPlaysState = {
  plays: ManualPlay[];
  loading: boolean;
  error: string | null;
};

type Listener = (s: ManualPlaysState) => void;

let cache: ManualPlaysState = {
  plays: [],
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: ManualPlaysState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<ManualPlaysState> {
  try {
    const res = await fetch("/api/manual-plays", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return { plays: [], loading: false, error: null };
      }
      return { plays: [], loading: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { plays: ManualPlay[] };
    return { plays: data.plays, loading: false, error: null };
  } catch (err) {
    return { plays: [], loading: false, error: (err as Error).message };
  }
}

export function useManualPlays() {
  const session = useSession();
  const [state, setState] = useState<ManualPlaysState>(cache);

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
      id?: number;
      name: string;
      editor: string | null;
      rating: number;
      playedOn: string | null;
      note: string | null;
    }) => {
      const res = await fetch("/api/manual-plays", {
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

  const remove = useCallback(async (id: number) => {
    const res = await fetch(`/api/manual-plays?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `http_${res.status}`);
    }
    const fresh = await load();
    setShared(fresh);
  }, []);

  return { ...state, save, remove };
}
