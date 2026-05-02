import { connectDb } from "@/lib/db/connect";
import { AppSettingsModel } from "@/lib/db/models/AppSettings";

const GLOBAL_KEY = "global";

export async function getMinimumOrderInclGst(): Promise<number> {
  await connectDb();
  const row = await AppSettingsModel.findOne({ key: GLOBAL_KEY }).select("minimumOrderInclGst").lean();
  const n = row?.minimumOrderInclGst;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  return 25_000;
}

export async function getPricesEffectiveDate(): Promise<string> {
  await connectDb();
  const row = await AppSettingsModel.findOne({ key: GLOBAL_KEY }).select("pricesEffectiveDate").lean();
  const d = row?.pricesEffectiveDate;
  if (typeof d === "string" && d.trim()) return d;
  return "01-04-2026";
}

