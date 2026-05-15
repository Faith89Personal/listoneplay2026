"use client";

import { useEffect, useState } from "react";
import type { Item, Vote } from "@/types";

const CACHE_KEY = "listoneplay2026:dataset:v1";
const TTL_MS = 10 * 60 * 1000;

type Dataset = { items: Item[]; voteCounts: Record<number, number> };
type CachedEnvelope = { savedAt: number; data: Dataset };

export type FetchState = {
  data: Dataset | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  refresh: () => void;
};

function readCache(): CachedEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope;
    if (
      parsed &&
      typeof parsed.savedAt === "number" &&
      parsed.data &&
      Array.isArray(parsed.data.items)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(data: Dataset) {
  if (typeof window === "undefined") return;
  try {
    const env: CachedEnvelope = { savedAt: Date.now(), data };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch {
    // ignore quota errors
  }
}

function tallyVotes(votes: Vote[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const v of votes) {
    const id = v.id.idItem;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

async function fetchDataset(): Promise<Dataset> {
  const [itemsRes, votesRes] = await Promise.all([
    fetch("/api/items", { cache: "no-store" }),
    fetch("/api/votes", { cache: "no-store" }),
  ]);
  if (!itemsRes.ok) throw new Error(`items_${itemsRes.status}`);
  const items = (await itemsRes.json()) as Item[];
  const votes = votesRes.ok ? ((await votesRes.json()) as Vote[]) : [];
  return { items, voteCounts: tallyVotes(votes) };
}

export function useItems(): FetchState {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    const cacheFresh = cached && Date.now() - cached.savedAt < TTL_MS;

    if (cached) {
      setData(cached.data);
      setStale(!cacheFresh);
      if (cacheFresh) setLoading(false);
    }

    if (cacheFresh && tick === 0) return;

    fetchDataset()
      .then((fresh) => {
        if (cancelled) return;
        setData(fresh);
        setError(null);
        setStale(false);
        writeCache(fresh);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (!cached) setError(err.message || "fetch_failed");
        else setStale(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    data,
    loading,
    error,
    stale,
    refresh: () => setTick((t) => t + 1),
  };
}
