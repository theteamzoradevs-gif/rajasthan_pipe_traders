import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { getMinimumOrderInclGst } from "@/lib/db/appSettings";
import {
  resolveCartComboPricing,
  type IncomingCartLineForCombo,
  type LeanProductForCombo,
} from "@/lib/combo/resolveCartComboPricing";
import { logApiRouteError } from "@/lib/http/apiError";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function parseLines(raw: unknown): IncomingCartLineForCombo[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IncomingCartLineForCombo[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const size = typeof o.size === "string" ? o.size : "";
    if (!size.trim()) continue;
    const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    if (!Number.isFinite(quantity)) continue;
    const mongoProductId =
      typeof o.mongoProductId === "string" && o.mongoProductId.trim()
        ? o.mongoProductId.trim()
        : undefined;
    const productId =
      o.productId !== undefined && o.productId !== null
        ? typeof o.productId === "number"
          ? o.productId
          : Number(o.productId)
        : undefined;
    out.push({
      mongoProductId,
      productId: Number.isFinite(productId) ? productId : undefined,
      productSlug: typeof o.productSlug === "string" ? o.productSlug : undefined,
      size,
      sellerId: typeof o.sellerId === "string" ? o.sellerId : undefined,
      orderMode: o.orderMode === "master_bag" ? "master_bag" : "packets",
      quantity,
      qtyPerBag: typeof o.qtyPerBag === "number" ? o.qtyPerBag : Number(o.qtyPerBag) || 0,
      pcsPerPacket: typeof o.pcsPerPacket === "number" ? o.pcsPerPacket : Number(o.pcsPerPacket) || 1,
      pricePerUnit: typeof o.pricePerUnit === "number" ? o.pricePerUnit : Number(o.pricePerUnit) || 0,
      basicPricePerUnit:
        typeof o.basicPricePerUnit === "number" ? o.basicPricePerUnit : Number(o.basicPricePerUnit) || 0,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const lines = parseLines(body.lines);
    if (lines === null) return err("lines must be an array", 400);
    const preferListOverCombo = body.preferListOverCombo === true;

    await connectDb();
    const ids = [
      ...new Set(
        lines
          .map((l) => l.mongoProductId)
          .filter((id): id is string => Boolean(id && mongoose.Types.ObjectId.isValid(id)))
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const products =
      ids.length > 0
        ? await ProductModel.find({ _id: { $in: ids } })
          .select("isEligibleForCombo sizes sellers pricing sizeOrModel slug legacyId category packaging")
          .lean()
        : [];

    const productByMongoId = new Map<string, LeanProductForCombo>();
    for (const p of products) {
      productByMongoId.set(p._id.toString(), p as unknown as LeanProductForCombo);
    }

    const result = await resolveCartComboPricing(lines, productByMongoId, {
      skipComboAllocation: preferListOverCombo,
    });
    const minimumOrderInclGst = await getMinimumOrderInclGst();

    return NextResponse.json({
      data: {
        lines: result.lines,
        eligiblePacketTotal: result.eligiblePacketTotal,
        corePacketTotal: result.corePacketTotal,
        comboMatchedCorePackets: result.comboMatchedCorePackets,
        cartTotalInclGst: result.cartTotalInclGst,
        cartBasicTotal: result.cartBasicTotal,
        comboSavingsInclGst: result.comboSavingsInclGst,
        smartSuggestion: result.smartSuggestion,
        comboEligibleTargets: result.comboEligibleTargets ?? [],
        comboFallbackTargets: result.comboFallbackTargets ?? [],
        comboSwapTargetSlugs: result.comboSwapTargetSlugs ?? [],
        comboRemoveWhenNoTriggerSlugs: result.comboRemoveWhenNoTriggerSlugs ?? [],
        minimumOrderInclGst,
        minimumOrderMet: result.cartTotalInclGst >= minimumOrderInclGst,
      },
    });
  } catch (e) {
    logApiRouteError("POST /api/cart/combo-pricing", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
