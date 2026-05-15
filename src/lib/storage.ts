"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "listoneplay2026:selections:v1";

export type SelectionFlag = "look" | "play" | "buy";
export type Selections = Record<number, Partial<Record<SelectionFlag, true>>>;

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

export function useSelections() {
  const [selections, setSelections] = useState<Selections>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelections(readSelections());
    setHydrated(true);
  }, []);

  function toggle(itemId: number, flag: SelectionFlag) {
    setSelections((prev) => {
      const current = prev[itemId] ?? {};
      const next: Selections = { ...prev };
      if (current[flag]) {
        const { [flag]: _, ...rest } = current;
        if (Object.keys(rest).length === 0) {
          delete next[itemId];
        } else {
          next[itemId] = rest;
        }
      } else {
        next[itemId] = { ...current, [flag]: true };
      }
      writeSelections(next);
      return next;
    });
  }

  return { selections, toggle, hydrated };
}
