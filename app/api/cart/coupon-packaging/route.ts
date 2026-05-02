import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { buildPackagingContextFromProduct } from "@/lib/coupons/couponTierQuantity";
import { logApiRouteError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";

type LineIn = {
  productMongoId?: string;
  legacyProductId?: number;
  size?: string;
  sellerId?: string;
};

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * Returns MongoDB packaging + size-row context for each cart line (same order as input),
 * used client-side to align coupon tier packet counts with `pricingUnit` (carton/box/bag/packet).
 */
export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as { lines?: LineIn[] };
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const idStrings: string[] = [];
    const legacyIds = new Set<number>();
    for (const row of lines) {
      const pid = row.productMongoId?.trim();
      if (pid && mongoose.Types.ObjectId.isValid(pid)) {
        idStrings.push(pid);
      } else {
        const lid =
          row.legacyProductId !== undefined
            ? typeof row.legacyProductId === "number"
              ? row.legacyProductId
              : Number(row.legacyProductId)
            : NaN;
        if (Number.isFinite(lid) && lid > 0) legacyIds.add(Math.floor(lid));
      }
    }

    const uniqueIds = [...new Set(idStrings)];
    const [byOidRows, byLegacyRows] = await Promise.all([
      uniqueIds.length > 0
        ? ProductModel.find({ _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) } })
            .select({ sellers: 1, sizes: 1, packaging: 1, legacyId: 1 })
            .lean()
        : Promise.resolve([]),
      legacyIds.size > 0
        ? ProductModel.find({ legacyId: { $in: [...legacyIds] } })
            .select({ sellers: 1, sizes: 1, packaging: 1, legacyId: 1 })
            .lean()
        : Promise.resolve([]),
    ]);

    const byId = new Map<string, (typeof byOidRows)[0]>();
    for (const p of [...byOidRows, ...byLegacyRows]) {
      byId.set(String(p._id), p);
    }

    const byLegacy = new Map<number, (typeof byLegacyRows)[0]>();
    for (const p of byLegacyRows) {
      if (p.legacyId != null) byLegacy.set(Number(p.legacyId), p);
    }

    const out = lines.map((row) => {
      let pid = row.productMongoId?.trim();
      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
        const lid =
          row.legacyProductId !== undefined
            ? typeof row.legacyProductId === "number"
              ? row.legacyProductId
              : Number(row.legacyProductId)
            : NaN;
        if (Number.isFinite(lid) && lid > 0) {
          const lp = byLegacy.get(Math.floor(lid));
          if (lp) pid = String(lp._id);
        }
      }
      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
        return null;
      }
      const prod = byId.get(pid);
      if (!prod) return null;
      return buildPackagingContextFromProduct(
        prod as Parameters<typeof buildPackagingContextFromProduct>[0],
        row.sellerId,
        row.size
      );
    });

    return NextResponse.json({ data: out });
  } catch (e) {
    logApiRouteError("POST /api/cart/coupon-packaging", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
