import { NextResponse } from "next/server";
import { getHomeBanner } from "@/lib/banner/resolveHomeBanner";
import { logApiRouteError } from "@/lib/http/apiError";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET() {
  try {
    const data = await getHomeBanner();
    return NextResponse.json({ data });
  } catch (e) {
    logApiRouteError("GET /api/banner", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
