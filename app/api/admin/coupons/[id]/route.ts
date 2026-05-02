import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { CouponModel } from "@/lib/db/models/Coupon";
import { serializeCouponLean } from "@/lib/db/serialize";
import {
  isDiscountType,
  parseObjectIdList,
  parsePacketTiers,
  parseTierUnit,
  validatePacketTiersForDiscountType,
} from "@/lib/coupons/couponPayload";

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid coupon id", 400);
    await connectDb();
    const row = await CouponModel.findById(id)
      .populate("applicableProductIds", "sku name slug")
      .populate("applicableCategoryIds", "name slug")
      .lean();
    if (!row) return err("Coupon not found", 404);
    return NextResponse.json({
      data: serializeCouponLean(row as Parameters<typeof serializeCouponLean>[0]),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid coupon id", 400);
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const $set: Record<string, unknown> = {};

    if (typeof body.code === "string") $set.code = body.code.trim().toUpperCase();
    if (typeof body.name === "string") $set.name = body.name.trim();
    if (typeof body.description === "string") $set.description = body.description.trim();

    let nextDiscountType: "percentage" | "flat" | undefined;
    if (body.discountType !== undefined) {
      if (!isDiscountType(body.discountType)) {
        return err("discountType must be percentage or flat", 400);
      }
      $set.discountType = body.discountType;
      nextDiscountType = body.discountType;
    }

    if (body.packetTiers !== undefined) {
      const discountType =
        nextDiscountType ??
        ((await CouponModel.findById(id).select("discountType").lean()) as { discountType?: string } | null)
          ?.discountType;
      if (!isDiscountType(discountType)) {
        return err("Could not resolve discountType for tier validation", 400);
      }
      const packetTiers = parsePacketTiers(body.packetTiers);
      const tierErr = validatePacketTiersForDiscountType(packetTiers, discountType);
      if (tierErr) return err(tierErr, 400);
      $set.packetTiers = packetTiers;
    }

    if (body.applicableProductIds !== undefined) {
      $set.applicableProductIds = parseObjectIdList(body.applicableProductIds);
    }
    if (body.applicableCategoryIds !== undefined) {
      $set.applicableCategoryIds = parseObjectIdList(body.applicableCategoryIds);
    }
    if (typeof body.isActive === "boolean") $set.isActive = body.isActive;
    if (body.tierUnit !== undefined) {
      $set.tierUnit = parseTierUnit(body.tierUnit);
    }

    if ($set.discountType !== undefined && body.packetTiers === undefined) {
      const existing = await CouponModel.findById(id).select("packetTiers discountType").lean();
      if (!existing) return err("Coupon not found", 404);
      const tiers = (existing as { packetTiers?: { minPackets: number; value: number }[] }).packetTiers ?? [];
      const effType = $set.discountType as "percentage" | "flat";
      const tierErr = validatePacketTiersForDiscountType(
        tiers.map((t) => ({ minPackets: t.minPackets, value: t.value })),
        effType
      );
      if (tierErr) return err(`${tierErr} (change tiers or keep discount type)`, 400);
    }

    const mongoUpdate: { $set?: Record<string, unknown> } = {};
    if (Object.keys($set).length) mongoUpdate.$set = $set;

    let row;
    if (!mongoUpdate.$set) {
      row = await CouponModel.findById(id)
        .populate("applicableProductIds", "sku name slug")
        .populate("applicableCategoryIds", "name slug")
        .lean();
    } else {
      row = await CouponModel.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true })
        .populate("applicableProductIds", "sku name slug")
        .populate("applicableCategoryIds", "name slug")
        .lean();
    }
    if (!row) return err("Coupon not found", 404);
    return NextResponse.json({
      data: serializeCouponLean(row as Parameters<typeof serializeCouponLean>[0]),
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
      return err("A coupon with this code already exists", 409);
    }
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return err("Invalid coupon id", 400);
    await connectDb();
    const deleted = await CouponModel.findByIdAndDelete(id).lean();
    if (!deleted) return err("Coupon not found", 404);
    return NextResponse.json({ data: { _id: id, deleted: true } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
