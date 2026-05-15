"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/useSession";
import type { Item } from "@/types";

export type ManualItem = {
  id: number;
  name: string;
  editor: string;
  categoryId: number;
  stand: string | null;
  idBgg: number | null;
};

export type ManualItemsState = {
  items: ManualItem[];
  loading: boolean;
  error: string | null;
};

type Listener = (s: ManualItemsState) => void;

let cache: ManualItemsState = {
  items: [],
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: ManualItemsState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<ManualItemsState> {
  try {
    const res = await fetch("/api/manual-items", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return { items: [], loading: false, error: null };
      }
      return { items: [], loading: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { items: ManualItem[] };
    return { items: data.items, loading: false, error: null };
  } catch (err) {
    return { items: [], loading: false, error: (err as Error).message };
  }
}

export const CATEGORY_BY_ID: Record<
  number,
  { id: number; name: string; ordering: number }
> = {
  1: { id: 1, name: "GIOCHI DA TAVOLO", ordering: 0 },
  2: { id: 2, name: "GIOCHI DI RUOLO", ordering: 1 },
  3: { id: 3, name: "LIBROGAME ED EDITORIA", ordering: 2 },
};

export function manualToItem(m: ManualItem, nowIso: string): Item {
  const category = CATEGORY_BY_ID[m.categoryId] ?? CATEGORY_BY_ID[1];
  return {
    id: m.id,
    name: m.name,
    isAvailable: true,
    isPlayable: true,
    isBuyable: true,
    updateDate: nowIso,
    bookType: null,
    notBuyableType: null,
    editor: { id: 0, name: m.editor || "Senza editore" },
    category,
    idBgg: m.idBgg,
  };
}

export function useManualItems() {
  const session = useSession();
  const [state, setState] = useState<ManualItemsState>(cache);

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
      setShared({ items: [], loading: false, error: null });
      return;
    }
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [session.loading, session.email]);

  const save = useCallback(
    async (m: {
      id?: number;
      name: string;
      editor: string;
      categoryId: number;
      stand: string | null;
      idBgg: number | null;
    }) => {
      const res = await fetch("/api/manual-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
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
    const res = await fetch(`/api/manual-items?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `http_${res.status}`);
    }
    const fresh = await load();
    setShared(fresh);
  }, []);

  const asItems = useMemo(() => {
    const now = new Date().toISOString();
    return state.items.map((m) => manualToItem(m, now));
  }, [state.items]);

  return {
    ...state,
    save,
    remove,
    asItems,
    loggedIn: !!session.email,
  };
}

export function isManualItemId(id: number): boolean {
  return id < 0;
}
