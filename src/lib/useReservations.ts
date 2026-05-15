"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";

export type Reservation = {
  itemId: number;
  reservedAt: string; // ISO UTC
  durationMinutes: number;
  note: string | null;
  shareToken: string | null;
  maxSeats: number | null;
  sharedWith: string[];
  guests: string[];
  ownerEmail: string;
  isOwner: boolean;
};

export type ReservationsState = {
  reservations: Reservation[];
  loading: boolean;
  error: string | null;
};

type Listener = (s: ReservationsState) => void;

let cache: ReservationsState = {
  reservations: [],
  loading: true,
  error: null,
};
let cachedForEmail: string | null = null;
const listeners = new Set<Listener>();

function setShared(next: ReservationsState) {
  cache = next;
  for (const fn of listeners) fn(next);
}

async function load(): Promise<ReservationsState> {
  try {
    const res = await fetch("/api/reservations", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) {
        return { reservations: [], loading: false, error: null };
      }
      return { reservations: [], loading: false, error: `http_${res.status}` };
    }
    const data = (await res.json()) as { reservations: Reservation[] };
    return { reservations: data.reservations, loading: false, error: null };
  } catch (err) {
    return {
      reservations: [],
      loading: false,
      error: (err as Error).message,
    };
  }
}

export function overlapsBetween(
  a: { reservedAt: string; durationMinutes: number },
  b: { reservedAt: string; durationMinutes: number },
): boolean {
  const aStart = new Date(a.reservedAt).getTime();
  const aEnd = aStart + a.durationMinutes * 60_000;
  const bStart = new Date(b.reservedAt).getTime();
  const bEnd = bStart + b.durationMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlaps(
  candidate: { itemId: number; reservedAt: string; durationMinutes: number },
  list: Reservation[],
): Reservation[] {
  return list.filter(
    (r) => r.itemId !== candidate.itemId && overlapsBetween(candidate, r),
  );
}

export function useReservations() {
  const session = useSession();
  const [state, setState] = useState<ReservationsState>(cache);

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
      setShared({ reservations: [], loading: false, error: null });
      return;
    }
    if (cachedForEmail === session.email && !cache.loading) return;
    cachedForEmail = session.email;
    setShared({ ...cache, loading: true });
    load().then(setShared);
  }, [session.loading, session.email]);

  const save = useCallback(
    async (r: {
      itemId: number;
      reservedAt: string;
      durationMinutes: number;
      note: string | null;
      maxSeats: number | null;
      guests?: string[];
    }) => {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
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
    const res = await fetch(`/api/reservations?itemId=${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `http_${res.status}`);
    }
    const fresh = await load();
    setShared(fresh);
  }, []);

  return {
    ...state,
    save,
    remove,
    loggedIn: !!session.email,
    sessionLoading: session.loading,
  };
}
