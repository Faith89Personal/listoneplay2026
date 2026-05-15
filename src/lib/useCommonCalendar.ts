"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import type { Reservation } from "@/lib/useReservations";
import type { ManualEvent } from "@/lib/useManualEvents";

export type CommonCalendarState = {
  reservations: Reservation[];
  events: ManualEvent[];
  participantNames: Record<string, string>;
  loading: boolean;
  error: string | null;
};

type Listener = (s: CommonCalendarState) => void;

let cache: CommonCalendarState = {
  reservations: [],
  events: [],
  participantNames: {},
  loading: false,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: CommonCalendarState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<CommonCalendarState> {
  try {
    const [resRes, evRes] = await Promise.all([
      fetch("/api/reservations?scope=all", { cache: "no-store" }),
      fetch("/api/manual-events?scope=all", { cache: "no-store" }),
    ]);
    if (resRes.status === 401 || evRes.status === 401) {
      return {
        reservations: [],
        events: [],
        participantNames: {},
        loading: false,
        error: null,
      };
    }
    if (!resRes.ok || !evRes.ok) {
      return {
        reservations: [],
        events: [],
        participantNames: {},
        loading: false,
        error: `http_${resRes.ok ? evRes.status : resRes.status}`,
      };
    }
    const resData = (await resRes.json()) as {
      reservations: Reservation[];
      participantNames?: Record<string, string>;
    };
    const evData = (await evRes.json()) as {
      events: ManualEvent[];
      participantNames?: Record<string, string>;
    };
    return {
      reservations: resData.reservations,
      events: evData.events,
      participantNames: {
        ...(resData.participantNames ?? {}),
        ...(evData.participantNames ?? {}),
      },
      loading: false,
      error: null,
    };
  } catch (err) {
    return {
      reservations: [],
      events: [],
      participantNames: {},
      loading: false,
      error: (err as Error).message,
    };
  }
}

export function useCommonCalendar(enabled: boolean) {
  const session = useSession();
  const [state, setState] = useState<CommonCalendarState>(cache);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (session.loading || !session.email) return;
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [enabled, session.loading, session.email]);

  const reload = useCallback(async () => {
    if (!session.email) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    const fresh = await load();
    setShared(fresh);
  }, [session.email]);

  return { ...state, reload };
}
