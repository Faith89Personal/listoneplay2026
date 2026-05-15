"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export type ManualEvent = {
  id: number;
  name: string;
  reservedAt: string;
  durationMinutes: number;
  stand: string | null;
  note: string | null;
  shareToken: string | null;
  maxSeats: number | null;
  sharedWith: string[];
  guests: string[];
  ownerEmail: string;
  isOwner: boolean;
};

export type ManualEventsState = {
  events: ManualEvent[];
  participantNames: Record<string, string>;
  loading: boolean;
  error: string | null;
};

type Listener = (s: ManualEventsState) => void;

let cache: ManualEventsState = {
  events: [],
  participantNames: {},
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: ManualEventsState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<ManualEventsState> {
  try {
    const res = await fetch("/api/manual-events", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return {
          events: [],
          participantNames: {},
          loading: false,
          error: null,
        };
      }
      return {
        events: [],
        participantNames: {},
        loading: false,
        error: `http_${res.status}`,
      };
    }
    const data = (await res.json()) as {
      events: ManualEvent[];
      participantNames?: Record<string, string>;
    };
    return {
      events: data.events,
      participantNames: data.participantNames ?? {},
      loading: false,
      error: null,
    };
  } catch (err) {
    return {
      events: [],
      participantNames: {},
      loading: false,
      error: (err as Error).message,
    };
  }
}

export function useManualEvents() {
  const session = useSession();
  const [state, setState] = useState<ManualEventsState>(cache);

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
      setShared({
        events: [],
        participantNames: {},
        loading: false,
        error: null,
      });
      return;
    }
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [session.loading, session.email]);

  const save = useCallback(
    async (e: {
      id?: number;
      name: string;
      reservedAt: string;
      durationMinutes: number;
      stand: string | null;
      note: string | null;
      maxSeats?: number | null;
      guests?: string[];
      sharedWith?: string[];
    }): Promise<{ id: number; shareToken: string | null }> => {
      const res = await fetch("/api/manual-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `http_${res.status}`);
      }
      const data = (await res.json()) as {
        id: number;
        shareToken: string | null;
      };
      const fresh = await load();
      setShared(fresh);
      return { id: data.id, shareToken: data.shareToken };
    },
    [],
  );

  const remove = useCallback(async (id: number) => {
    const res = await fetch(`/api/manual-events?id=${id}`, {
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
