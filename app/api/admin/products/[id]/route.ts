import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import {
  findGlobalProductSortOrderConflict,
  parseSortOrderInput,
  productSortOrderConflictPayload,
} from "@/lib/db/productSortOrder";
import { ProductModel } from "@/lib/db/models/Product";
import { CategoryModel } from "@/lib/db/models/Category";
import { serializeProductLean } from "@/lib/db/serialize";
import { sanitizeKeyFeaturesInput } from "@/app/lib/sanitizeKeyFeatures";
import { serverFetchError } from "@/lib/http/apiError";
import { ensureUniqueProductSlug } from "@/lib/product/ensureUniqueProductSlug";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return err("Invalid product id", 400);
    }
    await connectDb();
    const row = await ProductModel.findById(id).populate("category", "name slug").lean();
    if (!row) return err("Product not found", 404);
    return NextResponse.json({
      data: serializeProductLean(row as Parameters<typeof serializeProductLean>[0]),
    });
  } catch (e) {
    return serverFetchError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return err("Invalid product id", 400);
    }
    await connectDb();
    const current = await ProductModel.findById(id).lean();
    if (!current) return err("Product not found", 404);

    const body = (await req.json()) as Record<string, unknown>;
    const swapWithRaw =
      typeof body.swapSortOrderWith === "string" ? body.swapSortOrderWith.trim() : "";
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    const scalarString = [
      "name",
      "description",
      "longDescription",
      "subCategory",
      "brandCode",
      "productLine",
      "sizeOrModel",
      "minOrder",
      "note",
      "listNotes",
      "sourceDocument",
      "slug",
    ] as const;
    for (const key of scalarString) {
      if (typeof body[key] === "string") {
        $set[key] = key === "slug" ? (body[key] as string).trim().toLowerCase() : (body[key] as string);
      }
    }
    if ("brand" in body) {
      if (body.brand === null || body.brand === "") {
        $unset.brand = 1;
      } else if (typeof body.brand === "string") {
        $set.brand = body.brand.trim();
      }
    }
    if ("image" in body) {
      if (body.image === null || body.image === "") {
        $unset.image = 1;
      } else if (typeof body.image === "string") {
        $set.image = body.image.trim();
      }
    }
    if ("sku" in body) {
      if (body.sku === null || (typeof body.sku === "string" && body.sku.trim() === "")) {
        $unset.sku = 1;
      } else if (typeof body.sku === "string") {
        $set.sku = body.sku.trim().toUpperCase();
      }
    }
    if (body.productKind === "sku" || body.productKind === "catalog") $set.productKind = body.productKind;
    if (typeof body.isNew === "boolean") $set.isNew = body.isNew;
    if (typeof body.isIsiCertified === "boolean") $set.isIsiCertified = body.isIsiCertified;
    if (typeof body.isBestseller === "boolean") $set.isBestseller = body.isBestseller;
    if (typeof body.isActive === "boolean") $set.isActive = body.isActive;
    if (Object.prototype.hasOwnProperty.call(body, "isEligibleForCombo")) {
      const v = body.isEligibleForCombo;
      if (v === null || typeof v === "boolean") $set.isEligibleForCombo = v;
    }
    if ("moq" in body) {
      if (body.moq === null) {
        $unset.moq = 1;
      } else if (typeof body.moq === "number" && Number.isFinite(body.moq)) {
        $set.moq = body.moq;
      }
    }
    if ("moqBags" in body) {
      if (body.moqBags === null) {
        $unset.moqBags = 1;
      } else if (typeof body.moqBags === "number" && Number.isFinite(body.moqBags)) {
        $set.moqBags = body.moqBags;
      }
    }
    if (typeof body.legacyId === "number") $set.legacyId = body.legacyId;
    if (typeof body.sortOrder !== "undefined") {
      $set.sortOrder = parseSortOrderInput(body.sortOrder);
    }
    if ("keyFeatures" in body) {
      if (body.keyFeatures === null) {
        $unset.keyFeatures = 1;
        $set.features = [];
      } else if (Array.isArray(body.keyFeatures)) {
        const kf = sanitizeKeyFeaturesInput(body.keyFeatures);
        if (kf && kf.length > 0) {
          $set.keyFeatures = kf;
          $set.features = [];
        } else {
          $unset.keyFeatures = 1;
          $set.features = [];
        }
      }
    } else if (Array.isArray(body.features)) {
      $set.features = body.features;
    }
    if (body.images === null) {
      $unset.images = 1;
    } else if (Array.isArray(body.images)) {
      $set.images = body.images;
    }
    if (Array.isArray(body.tags)) $set.tags = body.tags;
    if (Array.isArray(body.certifications)) $set.certifications = body.certifications;
    if (Array.isArray(body.alternateSkus)) $set.alternateSkus = body.alternateSkus;
    if (body.discountTiers !== undefined) $set.discountTiers = body.discountTiers;
    if (body.sizes !== undefined) $set.sizes = body.sizes;
    if (body.sellers !== undefined) $set.sellers = body.sellers;
    if (typeof body.category === "string" && mongoose.Types.ObjectId.isValid(body.category)) {
      const cat = await CategoryModel.findById(body.category).lean();
      if (!cat) return err("Category not found", 400);
      $set.category = new mongoose.Types.ObjectId(body.category);
    }
    if (body.pricing && typeof body.pricing === "object") {
      const p = body.pricing as Record<string, unknown>;
      if (typeof p.basicPrice === "number") $set["pricing.basicPrice"] = p.basicPrice;
      if (typeof p.priceWithGst === "number") $set["pricing.priceWithGst"] = p.priceWithGst;
      if (typeof p.currency === "string") $set["pricing.currency"] = p.currency;
      if (p.priceListEffectiveDate !== undefined && p.priceListEffectiveDate !== null) {
        $set["pricing.priceListEffectiveDate"] = new Date(String(p.priceListEffectiveDate));
      }
    }
    if (body.packaging && typeof body.packaging === "object") {
      const pk = body.packaging as Record<string, unknown>;
      const packagingKeys = [
        "innerBoxPacking",
        "pcsInCartoon",
        "pcsPerPacket",
        "packetsInMasterBag",
        "pktInMasterBag",
        "pcsInPacket",
        "pcsPerBox",
        "boxesInMasterCartoon",
        "masterCartoonQty",
        "pricingUnit",
        "notes",
        "bulkUnitChoices",
        "innerUnitChoices",
      ] as const;
      for (const k of packagingKeys) {
        if (pk[k] !== undefined) {
          $set[`packaging.${k}`] = pk[k];
        }
      }
    }
    if (typeof $set.slug === "string") {
      const resolved = await ensureUniqueProductSlug($set.slug, { excludeProductId: id });
      if (resolved === undefined) {
        delete $set.slug;
        $unset.slug = 1;
      } else {
        $set.slug = resolved;
      }
    }
    const mongoUpdate: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = {};
    if (Object.keys($set).length) mongoUpdate.$set = $set;
    if (Object.keys($unset).length) mongoUpdate.$unset = $unset;

    let nextSortOrder = typeof current.sortOrder === "number" ? current.sortOrder : 0;
    if (typeof body.sortOrder !== "undefined") {
      nextSortOrder = parseSortOrderInput(body.sortOrder);
    }

    if (swapWithRaw) {
      if (typeof body.sortOrder === "undefined") {
        return err("sortOrder is required when swapping", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(swapWithRaw)) {
        return err("Invalid swapSortOrderWith", 400);
      }
      if (swapWithRaw === id) {
        return err("Cannot swap sort order with itself", 400);
      }
      const B = await ProductModel.findById(swapWithRaw).lean();
      if (!B) return err("Swap target product not found", 404);
      if (typeof B.sortOrder !== "number" || B.sortOrder !== nextSortOrder) {
        return err("Sort order conflict no longer matches. Try saving again.", 409);
      }
      const oldA = typeof current.sortOrder === "number" ? current.sortOrder : 0;
      if (!mongoUpdate.$set && !mongoUpdate.$unset) {
        return err("No fields to update", 400);
      }
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await ProductModel.updateOne({ _id: id }, mongoUpdate, { session });
          await ProductModel.updateOne(
            { _id: swapWithRaw },
            { $set: { sortOrder: oldA } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
      const swapped = await ProductModel.findById(id).populate("category", "name slug").lean();
      if (!swapped) return err("Product not found", 404);
      return NextResponse.json({
        data: serializeProductLean(swapped as Parameters<typeof serializeProductLean>[0]),
      });
    }

    const prevSort = typeof current.sortOrder === "number" ? current.sortOrder : 0;
    const sortOrderChanged =
      typeof body.sortOrder !== "undefined" &&
      parseSortOrderInput(body.sortOrder) !== prevSort;

    const shouldCheckSortConflict = nextSortOrder > 0 && sortOrderChanged;

    if (shouldCheckSortConflict) {
      const conflict = await findGlobalProductSortOrderConflict(nextSortOrder, id);
      if (conflict) {
        return NextResponse.json(
          productSortOrderConflictPayload(
            conflict as { _id: mongoose.Types.ObjectId; name: string; sortOrder: number }
          ),
          { status: 409 }
        );
      }
    }

    let row;
    if (!mongoUpdate.$set && !mongoUpdate.$unset) {
      row = await ProductModel.findById(id).populate("category", "name slug").lean();
    } else {
      row = await ProductModel.findByIdAndUpdate(id, mongoUpdate, { new: true, runValidators: true })
        .populate("category", "name slug")
        .lean();
    }
    if (!row) return err("Product not found", 404);
    return NextResponse.json({
      data: serializeProductLean(row as Parameters<typeof serializeProductLean>[0]),
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
      return err("Duplicate key (e.g. SKU or slug already exists)", 409);
    }
    return serverFetchError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return err("Invalid product id", 400);
    }
    await connectDb();
    const deleted = await ProductModel.findByIdAndDelete(id).lean();
    if (!deleted) return err("Product not found", 404);
    return NextResponse.json({ data: { _id: id, deleted: true } });
  } catch (e) {
    return serverFetchError(e);
  }
}
