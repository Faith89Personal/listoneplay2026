import { NextResponse } from "next/server";
import snapshot from "@/data/items.json";

const UPSTREAM = "https://list.giochisulnostrotavolo.it/be/public/api/items";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const revalidate = 600;

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
      const data = await res.json();
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
          "X-Data-Source": "upstream",
        },
      });
    }
  } catch {
    // fall through to snapshot
  }
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      "X-Data-Source": "snapshot",
    },
  });
}
