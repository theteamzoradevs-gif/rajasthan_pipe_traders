import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { MONGO_MAX_TIME_MS } from "@/lib/db/mongoTimeout";
import { logApiRouteError } from "@/lib/http/apiError";
import { AppSettingsModel } from "@/lib/db/models/AppSettings";

const GLOBAL_KEY = "global";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET() {
  try {
    await connectDb();
    let row = await AppSettingsModel.findOne({ key: GLOBAL_KEY }).maxTimeMS(MONGO_MAX_TIME_MS).lean();
    if (!row) {
      row = await AppSettingsModel.create({
        key: GLOBAL_KEY,
        minimumOrderInclGst: 25_000,
        pricesEffectiveDate: "01-04-2026",
      }).then((d) => d.toObject());
    }
    return NextResponse.json({
      data: {
        minimumOrderInclGst: row.minimumOrderInclGst ?? 25_000,
        pricesEffectiveDate: row.pricesEffectiveDate ?? "01-04-2026",
      },
    });
  } catch (e) {
    logApiRouteError("GET /api/admin/app-settings", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const mov = body.minimumOrderInclGst;
    const ped = body.pricesEffectiveDate;
    
    if (typeof mov !== "number" || !Number.isFinite(mov) || mov < 0) {
      return err("minimumOrderInclGst must be a non-negative number", 400);
    }
    
    if (ped !== undefined && typeof ped !== "string") {
      return err("pricesEffectiveDate must be a string", 400);
    }
    
    const updateData: Record<string, unknown> = { minimumOrderInclGst: mov };
    if (ped !== undefined) {
      updateData.pricesEffectiveDate = ped;
    }
    
    const row = await AppSettingsModel.findOneAndUpdate(
      { key: GLOBAL_KEY },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true, maxTimeMS: MONGO_MAX_TIME_MS }
    ).lean();
    
    return NextResponse.json({
      data: {
        minimumOrderInclGst: row?.minimumOrderInclGst ?? mov,
        pricesEffectiveDate: row?.pricesEffectiveDate ?? ped ?? "",
      },
    });
  } catch (e) {
    logApiRouteError("PATCH /api/admin/app-settings", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
