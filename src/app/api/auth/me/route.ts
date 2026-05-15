import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  return NextResponse.json({ email: session?.email ?? null });
}
