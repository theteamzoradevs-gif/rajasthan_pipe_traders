import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { CouponModel } from "@/lib/db/models/Coupon";
import type { CouponLean, ValidateCouponResult } from "@/lib/coupons/evaluate";
import { validateCouponAgainstCart } from "@/lib/coupons/evaluate";
import { resolveCartLinesForCoupon, type IncomingCouponLine } from "@/lib/coupons/resolveCartLines";
import { logApiRouteError } from "@/lib/http/apiError";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function parseIncomingLines(raw: unknown): IncomingCouponLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IncomingCouponLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    if (!Number.isFinite(quantity)) continue;

    let lineSubtotal: number | undefined;
    if (o.lineSubtotal !== undefined) {
      const n = typeof o.lineSubtotal === "number" ? o.lineSubtotal : Number(o.lineSubtotal);
      if (!Number.isFinite(n)) continue;
      lineSubtotal = n;
    }

    let lineBasicSubtotal: number | undefined;
    if (o.lineBasicSubtotal !== undefined) {
      const n = typeof o.lineBasicSubtotal === "number" ? o.lineBasicSubtotal : Number(o.lineBasicSubtotal);
      if (!Number.isFinite(n)) continue;
      lineBasicSubtotal = n;
    }

    let legacyProductId: number | undefined;
    if (o.legacyProductId !== undefined && o.legacyProductId !== null) {
      const n = typeof o.legacyProductId === "number" ? o.legacyProductId : Number(o.legacyProductId);
      if (Number.isFinite(n) && n > 0) legacyProductId = Math.floor(n);
    }

    let comboSubtotalInclGst: number | undefined;
    if (o.comboSubtotalInclGst !== undefined && o.comboSubtotalInclGst !== null) {
      const c = typeof o.comboSubtotalInclGst === "number" ? o.comboSubtotalInclGst : Number(o.comboSubtotalInclGst);
      if (Number.isFinite(c) && c >= 0) comboSubtotalInclGst = c;
    }

    let orderMode: IncomingCouponLine["orderMode"];
    if (o.orderMode === "packets" || o.orderMode === "master_bag") {
      orderMode = o.orderMode;
    }

    let rawQuantity: number | undefined;
    if (o.rawQuantity !== undefined && o.rawQuantity !== null) {
      const rq = typeof o.rawQuantity === "number" ? o.rawQuantity : Number(o.rawQuantity);
      if (Number.isFinite(rq) && rq > 0) rawQuantity = rq;
    }

    out.push({
      productMongoId: typeof o.productMongoId === "string" ? o.productMongoId.trim() : undefined,
      legacyProductId,
      categoryMongoId: typeof o.categoryMongoId === "string" ? o.categoryMongoId.trim() : undefined,
      sellerId: typeof o.sellerId === "string" ? o.sellerId.trim() : undefined,
      size: typeof o.size === "string" ? o.size.trim() : undefined,
      quantity,
      lineSubtotal,
      lineBasicSubtotal,
      comboSubtotalInclGst,
      ...(orderMode ? { orderMode } : {}),
      ...(rawQuantity !== undefined ? { rawQuantity } : {}),
    });
  }
  return out;
}

/** Same family split as `autoApplyCouponCandidates` in `cartCoupons.ts`. */
function couponPoolByTierPreference<T extends { tierUnit?: string }>(all: T[], preferOuter: boolean): T[] {
  if (all.length === 0) return all;
  const outer = all.filter((c) => c.tierUnit === "outer");
  const packets = all.filter((c) => c.tierUnit !== "outer");
  if (preferOuter) {
    return outer.length > 0 ? outer : all;
  }
  return packets.length > 0 ? packets : all;
}

type OkValidate = Extract<ValidateCouponResult, { ok: true }>;

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const codeRaw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const incoming = parseIncomingLines(body.lines);
    if (incoming === null) return err("lines must be an array", 400);

    const resolved = await resolveCartLinesForCoupon(incoming);
    if (!resolved.ok) {
      return NextResponse.json({ valid: false, reason: resolved.reason });
    }

    const { lines, preferOuterTierCoupons } = resolved;

    if (!codeRaw) {
      const docs = await CouponModel.find({ isActive: true }).sort({ name: 1, code: 1 }).lean();
      const pool = couponPoolByTierPreference(docs, preferOuterTierCoupons);

      let best: { coupon: CouponLean; result: OkValidate } | null = null;
      for (const doc of pool) {
        const coupon = doc as unknown as CouponLean;
        const result = validateCouponAgainstCart(coupon, lines);
        if (!result.ok || result.discountAmount <= 0) continue;
        if (
          !best ||
          result.discountAmount > best.result.discountAmount ||
          (result.discountAmount === best.result.discountAmount &&
            coupon.code.localeCompare(best.coupon.code) < 0)
        ) {
          best = { coupon, result };
        }
      }

      if (!best) {
        return NextResponse.json({
          valid: true,
          autoApplied: true,
          appliedCode: null,
          discountAmount: 0,
          eligibleSubtotal: 0,
          eligibleQuantity: 0,
          eligibleLineCount: 0,
          cartSubtotalInclGst: resolved.cartSubtotalInclGst,
          eligiblePacketCount: 0,
        });
      }

      const r = best.result;
      return NextResponse.json({
        valid: true,
        autoApplied: true,
        appliedCode: best.coupon.code,
        discountAmount: r.discountAmount,
        eligibleSubtotal: r.eligibleSubtotal,
        eligibleQuantity: r.eligibleQuantity,
        eligibleLineCount: r.eligibleLineCount,
        cartSubtotalInclGst: r.cartSubtotalInclGst,
        eligiblePacketCount: r.eligiblePacketCount,
      });
    }

    const couponDoc = await CouponModel.findOne({ code: codeRaw }).lean();
    const coupon = couponDoc as unknown as CouponLean | null;
    const result = validateCouponAgainstCart(coupon, lines);
    if (!result.ok) {
      return NextResponse.json({ valid: false, reason: result.reason });
    }

    return NextResponse.json({
      valid: true,
      autoApplied: false,
      appliedCode: codeRaw,
      discountAmount: result.discountAmount,
      eligibleSubtotal: result.eligibleSubtotal,
      eligibleQuantity: result.eligibleQuantity,
      eligibleLineCount: result.eligibleLineCount,
      cartSubtotalInclGst: result.cartSubtotalInclGst,
      eligiblePacketCount: result.eligiblePacketCount,
    });
  } catch (e) {
    logApiRouteError("POST /api/coupons/validate", e);
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
