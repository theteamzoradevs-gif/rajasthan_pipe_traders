import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { MONGO_MAX_TIME_MS } from "@/lib/db/mongoTimeout";
import { logApiRouteError } from "@/lib/http/apiError";
import { LeadModel } from "@/lib/db/models/Lead";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET() {
  try {
    await connectDb();
    const rows = await LeadModel.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .maxTimeMS(MONGO_MAX_TIME_MS)
      .lean();
    return NextResponse.json(
      { data: rows },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    logApiRouteError("GET /api/admin/leads", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
