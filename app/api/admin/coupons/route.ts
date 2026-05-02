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

export async function GET(req: NextRequest) {
  try {
    await connectDb();
    const sp = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = {};
    if (sp.get("isActive") === "true") filter.isActive = true;
    if (sp.get("isActive") === "false") filter.isActive = false;
    const rows = await CouponModel.find(filter)
      .populate("applicableProductIds", "sku name slug")
      .populate("applicableCategoryIds", "name slug")
      .sort({ name: 1, code: 1 })
      .lean();
    const data = rows.map((r) => serializeCouponLean(r as Parameters<typeof serializeCouponLean>[0])!);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return err("code is required", 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return err("name is required", 400);
    if (!isDiscountType(body.discountType)) {
      return err("discountType must be percentage or flat", 400);
    }
    const discountType = body.discountType;
    const packetTiers = parsePacketTiers(body.packetTiers);
    const tierErr = validatePacketTiersForDiscountType(packetTiers, discountType);
    if (tierErr) return err(tierErr, 400);

    const doc = await CouponModel.create({
      code,
      name,
      description: typeof body.description === "string" ? body.description.trim() : "",
      discountType,
      packetTiers,
      tierUnit: parseTierUnit(body.tierUnit),
      applicableProductIds: parseObjectIdList(body.applicableProductIds),
      applicableCategoryIds: parseObjectIdList(body.applicableCategoryIds),
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    const populated = await CouponModel.findById(doc._id)
      .populate("applicableProductIds", "sku name slug")
      .populate("applicableCategoryIds", "name slug")
      .lean();
    return NextResponse.json({
      data: serializeCouponLean(populated as Parameters<typeof serializeCouponLean>[0]),
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
      return err("A coupon with this code already exists", 409);
    }
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
