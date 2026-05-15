import { NextResponse } from "next/server";
import snapshot from "@/data/editors.json";

export const revalidate = 600;

export async function GET() {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      "X-Data-Source": "snapshot",
    },
  });
}
