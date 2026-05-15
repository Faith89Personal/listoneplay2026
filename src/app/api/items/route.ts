import { NextResponse } from "next/server";
import snapshot from "@/data/items.json";
import bggAliases from "@/data/bgg-aliases.json";
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

function applyBggAliases(items: Item[]): Item[] {
  const aliases = buildAliasMap();
  if (aliases.size === 0) return items;
  return items.map((it) =>
    it.idBgg ? it : aliases.has(it.name) ? { ...it, idBgg: aliases.get(it.name)! } : it,
  );
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
      return NextResponse.json(applyBggAliases(data), {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
          "X-Data-Source": "upstream",
        },
      });
    }
  } catch {
    // fall through to snapshot
  }
  return NextResponse.json(applyBggAliases(snapshot as Item[]), {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      "X-Data-Source": "snapshot",
    },
  });
}
