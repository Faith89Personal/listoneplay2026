"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "listoneplay2026:selections:v2";

export type SelectionFlag = "look" | "play" | "buy";
export type CellState = "checked" | "forbidden";
export type Selections = Record<
  number,
  Partial<Record<SelectionFlag, CellState>>
>;

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

export function useSelections() {
  const [selections, setSelections] = useState<Selections>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelections(readSelections());
    setHydrated(true);
  }, []);

  function cycle(itemId: number, flag: SelectionFlag) {
    setSelections((prev) => {
      const current = prev[itemId] ?? {};
      const next: Selections = { ...prev };
      const updated = { ...current };
      const nv = nextState(current[flag]);
      if (nv === undefined) {
        delete updated[flag];
      } else {
        updated[flag] = nv;
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
