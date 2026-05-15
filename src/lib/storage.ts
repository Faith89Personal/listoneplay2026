"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/useSession";

const STORAGE_KEY = "listoneplay2026:selections:v2";

export type SelectionFlag = "look" | "play" | "buy";
export type CellState = "checked" | "forbidden";
export type Selections = Record<
  number,
  Partial<Record<SelectionFlag, CellState>>
>;

type PendingOp =
  | { kind: "upsert"; itemId: number; flag: SelectionFlag; state: CellState }
  | { kind: "delete"; itemId: number; flag: SelectionFlag };

function readSelections(): Selections {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Selections;
    return {};
  } catch {
    return {};
  }
}

function writeSelections(value: Selections) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // quota exceeded or storage disabled: ignore
  }
}

function nextState(current: CellState | undefined): CellState | undefined {
  if (current === undefined) return "checked";
  if (current === "checked") return "forbidden";
  return undefined;
}

type ApiSelections = Record<string, Partial<Record<string, string>>>;

function fromApi(api: ApiSelections): Selections {
  const out: Selections = {};
  for (const [idStr, flags] of Object.entries(api)) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || !flags) continue;
    const entry: Partial<Record<SelectionFlag, CellState>> = {};
    for (const f of ["look", "play", "buy"] as const) {
      const v = flags[f];
      if (v === "checked" || v === "forbidden") entry[f] = v;
    }
    if (Object.keys(entry).length > 0) out[id] = entry;
  }
  return out;
}

function diffMissingOps(local: Selections, remote: Selections): PendingOp[] {
  const ops: PendingOp[] = [];
  for (const [idStr, flags] of Object.entries(local)) {
    const id = Number(idStr);
    if (!flags) continue;
    const remoteFlags = remote[id] ?? {};
    for (const f of ["look", "play", "buy"] as const) {
      const lv = flags[f];
      const rv = remoteFlags[f];
      if (lv && lv !== rv) ops.push({ kind: "upsert", itemId: id, flag: f, state: lv });
    }
  }
  return ops;
}

async function sendOps(ops: PendingOp[]) {
  if (ops.length === 0) return;
  const upserts = ops
    .filter((o) => o.kind === "upsert")
    .map((o) => ({ itemId: o.itemId, flag: o.flag, state: (o as { state: CellState }).state }));
  const deletes = ops
    .filter((o) => o.kind === "delete")
    .map((o) => ({ itemId: o.itemId, flag: o.flag }));
  await fetch("/api/selections", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upserts, deletes }),
  });
}

export function useSelections() {
  const [selections, setSelections] = useState<Selections>({});
  const [hydrated, setHydrated] = useState(false);
  const session = useSession();
  const pendingRef = useRef<PendingOp[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedEmailRef = useRef<string | null>(null);

  useEffect(() => {
    setSelections(readSelections());
    setHydrated(true);
  }, []);

  // On login: pull from DB, merge with local, upload local-only entries
  useEffect(() => {
    if (!hydrated) return;
    if (session.loading) return;
    if (!session.email) {
      lastSyncedEmailRef.current = null;
      return;
    }
    if (lastSyncedEmailRef.current === session.email) return;
    lastSyncedEmailRef.current = session.email;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/selections", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { selections: ApiSelections };
        const remote = fromApi(data.selections);
        const local = readSelections();
        const merged: Selections = { ...remote };
        // local additions win for keys remote doesn't have
        for (const [idStr, flags] of Object.entries(local)) {
          const id = Number(idStr);
          if (!flags) continue;
          const existing = merged[id] ?? {};
          for (const f of ["look", "play", "buy"] as const) {
            if (!existing[f] && flags[f]) existing[f] = flags[f];
          }
          if (Object.keys(existing).length > 0) merged[id] = existing;
        }
        if (cancelled) return;
        writeSelections(merged);
        setSelections(merged);
        const ops = diffMissingOps(local, remote);
        if (ops.length > 0) await sendOps(ops);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.loading, session.email, hydrated]);

  function flushPending() {
    const ops = pendingRef.current;
    pendingRef.current = [];
    if (ops.length === 0) return;
    if (!session.email) return;
    sendOps(ops).catch(() => {
      // best-effort
    });
  }

  function queueOp(op: PendingOp) {
    if (!session.email) return;
    pendingRef.current.push(op);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushPending, 400);
  }

  function cycle(itemId: number, flag: SelectionFlag) {
    setSelections((prev) => {
      const current = prev[itemId] ?? {};
      const nv = nextState(current[flag]);
      const next: Selections = { ...prev };
      const updated = { ...current };
      if (nv === undefined) {
        delete updated[flag];
        queueOp({ kind: "delete", itemId, flag });
      } else {
        updated[flag] = nv;
        queueOp({ kind: "upsert", itemId, flag, state: nv });
      }
      if (Object.keys(updated).length === 0) {
        delete next[itemId];
      } else {
        next[itemId] = updated;
      }
      writeSelections(next);
      return next;
    });
  }

  return { selections, cycle, hydrated };
}
