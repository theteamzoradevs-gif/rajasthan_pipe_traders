import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { CouponModel } from "@/lib/db/models/Coupon";
import { toPublicCouponBanner } from "@/lib/coupons/evaluate";

/** DB-backed list must not be statically cached at build time */
export const dynamic = "force-dynamic";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/** Public coupons for banner strip and cart picker (all active). */
export async function GET(_req: NextRequest) {
  try {
    await connectDb();
    const rows = await CouponModel.find({ isActive: true }).sort({ name: 1, code: 1 }).lean();
    const data = rows.map((r, i) => toPublicCouponBanner(r as Record<string, unknown>, i));
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
