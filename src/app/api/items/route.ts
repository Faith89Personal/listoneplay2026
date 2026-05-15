import { NextResponse } from "next/server";
import snapshot from "@/data/items.json";
import bggAliases from "@/data/bgg-aliases.json";
import bggAuto from "@/data/bgg.json";
import type { Item } from "@/types";

const UPSTREAM = "https://list.giochisulnostrotavolo.it/be/public/api/items";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const revalidate = 600;

function buildAliasMap(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [name, value] of Object.entries(bggAliases)) {
    if (name.startsWith("_")) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out.set(name, value);
    }
  }
  return out;
}

function buildAutoMap(): Map<number, number> {
  const out = new Map<number, number>();
  const games =
    (bggAuto as { games?: Record<string, { bggId?: unknown }> }).games ?? {};
  for (const [idStr, info] of Object.entries(games)) {
    const itemId = Number(idStr);
    const bggId = (info as { bggId?: unknown })?.bggId;
    if (
      Number.isFinite(itemId) &&
      typeof bggId === "number" &&
      Number.isFinite(bggId)
    ) {
      out.set(itemId, bggId);
    }
  }
  return out;
}

function applyBgg(items: Item[]): Item[] {
  const aliases = buildAliasMap();
  const auto = buildAutoMap();
  if (aliases.size === 0 && auto.size === 0) return items;
  return items.map((it) => {
    if (it.idBgg) return it;
    if (aliases.has(it.name)) return { ...it, idBgg: aliases.get(it.name)! };
    if (auto.has(it.id)) return { ...it, idBgg: auto.get(it.id)! };
    return it;
  });
}

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, {
      next: { revalidate: 600 },
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
      },
    });
    if (res.ok) {
      const data = (await res.json()) as Item[];
      return NextResponse.json(applyBgg(data), {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
          "X-Data-Source": "upstream",
        },
      });
    }
  } catch {
    // fall through to snapshot
  }
  return NextResponse.json(applyBgg(snapshot as Item[]), {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      "X-Data-Source": "snapshot",
    },
  });
}
