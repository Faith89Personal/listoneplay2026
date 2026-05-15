import { NextResponse } from "next/server";
import snapshot from "@/data/editors.json";
import aliases from "@/data/editor-aliases.json";
import type { EditorsSnapshot } from "@/types";

export const revalidate = 600;

export async function GET() {
  const editors = { ...(snapshot.editors as EditorsSnapshot["editors"]) };
  for (const [name, value] of Object.entries(aliases)) {
    if (name.startsWith("_")) continue;
    if (Array.isArray(value) && value.length > 0) {
      editors[name] = {
        stands: value.map((s) => String(s).toUpperCase()),
        pdfName: editors[name]?.pdfName ?? "manual",
      };
    }
  }
  const payload: EditorsSnapshot = {
    source: snapshot.source,
    generatedAt: snapshot.generatedAt,
    editors,
  };
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      "X-Data-Source": "snapshot+aliases",
    },
  });
}
