import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import {
  bumpAllProductSortOrdersByOne,
  bumpCategoryProductSortOrdersByOne,
  findGlobalProductSortOrderConflict,
  maxSortOrderInProducts,
  normalizeNonPositiveCategoryProductSortOrders,
  normalizeNonPositiveProductSortOrders,
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findCreateDuplicateByNameBrand(params: {
  name: string;
  brand: string;
}): Promise<{ _id: mongoose.Types.ObjectId; name?: string; brand?: string } | null> {
  const nameRx = new RegExp(`^${escapeRegex(params.name)}$`, "i");
  const brandTrim = params.brand.trim();
  if (brandTrim) {
    const brandRx = new RegExp(`^${escapeRegex(brandTrim)}$`, "i");
    const row = await ProductModel.findOne({ name: nameRx, brand: brandRx })
      .select("_id name brand")
      .lean();
    return row as { _id: mongoose.Types.ObjectId; name?: string; brand?: string } | null;
  }
  const row = await ProductModel.findOne({ name: nameRx }).select("_id name brand").lean();
  return row as { _id: mongoose.Types.ObjectId; name?: string; brand?: string } | null;
}

export async function GET(req: NextRequest) {
  try {
    await connectDb();
    const sp = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = {};
    const categorySlug = sp.get("categorySlug");
    if (categorySlug) {
      const cat = await CategoryModel.findOne({ slug: categorySlug }).select("_id").lean();
      if (!cat) return err("No category matches categorySlug", 404);
      filter.category = cat._id;
    }
    const productKind = sp.get("productKind");
    if (productKind === "sku" || productKind === "catalog") {
      filter.productKind = productKind;
    }
    const isActiveParam = sp.get("isActive");
    if (isActiveParam === "true") filter.isActive = true;
    else if (isActiveParam === "false") filter.isActive = false;

    const comboParam = sp.get("isEligibleForCombo");
    if (comboParam === "true") filter.isEligibleForCombo = true;
    else if (comboParam === "false") filter.isEligibleForCombo = false;

    const q = sp.get("q")?.trim();
    if (q) {
      const esc = escapeRegex(q);
      filter.$or = [
        { name: { $regex: esc, $options: "i" } },
        { sku: { $regex: esc, $options: "i" } },
        { slug: { $regex: esc, $options: "i" } },
      ];
    }
    const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
    const skip = Math.max(0, Number(sp.get("skip")) || 0);
    const [rows, total] = await Promise.all([
      ProductModel.find(filter)
        .populate("category", "name slug")
        .sort({ sortOrder: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);
    const data = rows.map((r) => serializeProductLean(r as Parameters<typeof serializeProductLean>[0])!);
    return NextResponse.json({
      data,
      meta: { total, limit, skip },
    });
  } catch (e) {
    return serverFetchError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const skuRaw = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
    const sku = skuRaw || undefined;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const brand = typeof body.brand === "string" ? body.brand.trim() : "";
    const categoryId = typeof body.category === "string" ? body.category : "";
    if (!name || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return err("name and valid category (ObjectId) are required", 400);
    }
    const duplicate = await findCreateDuplicateByNameBrand({ name, brand });
    if (duplicate) {
      if (brand) {
        return err("Product with same name and brand already exists", 409);
      }
      return err("Product with same name already exists", 409);
    }
    const cat = await CategoryModel.findById(categoryId).lean();
    if (!cat) return err("Category not found", 400);
    const categoryOid = new mongoose.Types.ObjectId(categoryId);
    const sortOrder = parseSortOrderInput(body.sortOrder);
    const swapWithRaw =
      typeof body.swapSortOrderWith === "string" ? body.swapSortOrderWith.trim() : "";

    const conflict = sortOrder > 0 ? await findGlobalProductSortOrderConflict(sortOrder, null) : null;
    if (conflict) {
      if (
        swapWithRaw &&
        mongoose.Types.ObjectId.isValid(swapWithRaw) &&
        swapWithRaw === String(conflict._id)
      ) {
        const session = await mongoose.startSession();
        let doc;
        try {
          await session.withTransaction(async () => {
            const maxSo = await maxSortOrderInProducts(session);
            await ProductModel.updateOne(
              { _id: conflict._id },
              { $set: { sortOrder: maxSo + 1 } },
              { session }
            );
            const pricing = body.pricing as Record<string, unknown> | undefined;
            if (
              !pricing ||
              typeof pricing.basicPrice !== "number" ||
              typeof pricing.priceWithGst !== "number"
            ) {
              throw new Error("pricing.basicPrice and pricing.priceWithGst (numbers) are required");
            }
            const productKind = body.productKind === "catalog" ? "catalog" : "sku";
            const slugInput =
              typeof body.slug === "string" && body.slug.trim()
                ? body.slug.trim().toLowerCase()
                : undefined;
            const slug = await ensureUniqueProductSlug(slugInput);
            const kf = sanitizeKeyFeaturesInput(body.keyFeatures);
            const [created] = await ProductModel.create(
              [
                {
                  ...(sku ? { sku } : {}),
                  name,
                  productKind,
                  slug,
                  category: categoryOid,
                  sortOrder,
                  description: typeof body.description === "string" ? body.description : undefined,
                  longDescription:
                    typeof body.longDescription === "string" ? body.longDescription : undefined,
                  subCategory: typeof body.subCategory === "string" ? body.subCategory : undefined,
                  brand: typeof body.brand === "string" ? body.brand : undefined,
                  brandCode: typeof body.brandCode === "string" ? body.brandCode : undefined,
                  productLine: typeof body.productLine === "string" ? body.productLine : undefined,
                  sizeOrModel: typeof body.sizeOrModel === "string" ? body.sizeOrModel : undefined,
                  features:
                    kf && kf.length > 0 ? [] : Array.isArray(body.features) ? body.features : undefined,
                  ...(kf && kf.length > 0 ? { keyFeatures: kf } : {}),
                  image: typeof body.image === "string" ? body.image : undefined,
                  images: Array.isArray(body.images) ? body.images : undefined,
                  isNew: typeof body.isNew === "boolean" ? body.isNew : false,
                  isIsiCertified:
                    typeof body.isIsiCertified === "boolean" ? body.isIsiCertified : false,
                  isBestseller: typeof body.isBestseller === "boolean" ? body.isBestseller : undefined,
                  tags: Array.isArray(body.tags) ? body.tags : undefined,
                  certifications: Array.isArray(body.certifications) ? body.certifications : undefined,
                  material: typeof body.material === "string" ? body.material : undefined,
                  minOrder: typeof body.minOrder === "string" ? body.minOrder : undefined,
                  moq: typeof body.moq === "number" ? body.moq : undefined,
                  moqBags: typeof body.moqBags === "number" ? body.moqBags : undefined,
                  note: typeof body.note === "string" ? body.note : undefined,
                  listNotes: typeof body.listNotes === "string" ? body.listNotes : undefined,
                  alternateSkus: Array.isArray(body.alternateSkus) ? body.alternateSkus : undefined,
                  discountTiers: Array.isArray(body.discountTiers) ? body.discountTiers : undefined,
                  sizes: Array.isArray(body.sizes) ? body.sizes : undefined,
                  sellers: Array.isArray(body.sellers) ? body.sellers : undefined,
                  pricing: {
                    basicPrice: pricing.basicPrice,
                    priceWithGst: pricing.priceWithGst,
                    currency: typeof pricing.currency === "string" ? pricing.currency : "INR",
                    priceListEffectiveDate: pricing.priceListEffectiveDate
                      ? new Date(String(pricing.priceListEffectiveDate))
                      : undefined,
                  },
                  packaging:
                    typeof body.packaging === "object" && body.packaging !== null ? body.packaging : {},
                  isActive: typeof body.isActive === "boolean" ? body.isActive : true,
                  isEligibleForCombo:
                    typeof body.isEligibleForCombo === "boolean" ? body.isEligibleForCombo : null,
                  sourceDocument:
                    typeof body.sourceDocument === "string" ? body.sourceDocument : "RPT PRICE LIST",
                  legacyId: typeof body.legacyId === "number" ? body.legacyId : undefined,
                },
              ],
              { session }
            );
            doc = created;
          });
        } catch (e) {
          if (e instanceof Error && e.message.includes("pricing")) {
            return err(e.message, 400);
          }
          throw e;
        } finally {
          await session.endSession();
        }
        const populated = await ProductModel.findById(doc!._id).populate("category", "name slug").lean();
        return NextResponse.json({
          data: serializeProductLean(populated as Parameters<typeof serializeProductLean>[0]),
        });
      }
      return NextResponse.json(
        productSortOrderConflictPayload(
          conflict as { _id: mongoose.Types.ObjectId; name: string; sortOrder: number }
        ),
        { status: 409 }
      );
    }

    const pricing = body.pricing as Record<string, unknown> | undefined;
    if (
      !pricing ||
      typeof pricing.basicPrice !== "number" ||
      typeof pricing.priceWithGst !== "number"
    ) {
      return err("pricing.basicPrice and pricing.priceWithGst (numbers) are required", 400);
    }
    const productKind = body.productKind === "catalog" ? "catalog" : "sku";
    const slugInput =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim().toLowerCase()
        : undefined;
    const slug = await ensureUniqueProductSlug(slugInput);
    const kf = sanitizeKeyFeaturesInput(body.keyFeatures);

    const session = await mongoose.startSession();
    let doc!: { _id: mongoose.Types.ObjectId };
    try {
      await session.withTransaction(async () => {
        await normalizeNonPositiveProductSortOrders(session);
        await normalizeNonPositiveCategoryProductSortOrders(categoryOid, session);
        await bumpAllProductSortOrdersByOne(session);
        await bumpCategoryProductSortOrdersByOne(categoryOid, session);
        const createdArr = (await ProductModel.create(
          [
            {
              ...(sku ? { sku } : {}),
              name,
              productKind,
              slug,
              category: categoryOid,
              sortOrder: 1,
              categorySortOrder: 1,
              description: typeof body.description === "string" ? body.description : undefined,
              longDescription:
                typeof body.longDescription === "string" ? body.longDescription : undefined,
              subCategory: typeof body.subCategory === "string" ? body.subCategory : undefined,
              brand: typeof body.brand === "string" ? body.brand : undefined,
              brandCode: typeof body.brandCode === "string" ? body.brandCode : undefined,
              productLine: typeof body.productLine === "string" ? body.productLine : undefined,
              sizeOrModel: typeof body.sizeOrModel === "string" ? body.sizeOrModel : undefined,
              features:
                kf && kf.length > 0 ? [] : Array.isArray(body.features) ? body.features : undefined,
              ...(kf && kf.length > 0 ? { keyFeatures: kf } : {}),
              image: typeof body.image === "string" ? body.image : undefined,
              images: Array.isArray(body.images) ? body.images : undefined,
              isNew: typeof body.isNew === "boolean" ? body.isNew : false,
              isIsiCertified: typeof body.isIsiCertified === "boolean" ? body.isIsiCertified : false,
              isBestseller: typeof body.isBestseller === "boolean" ? body.isBestseller : undefined,
              tags: Array.isArray(body.tags) ? body.tags : undefined,
              certifications: Array.isArray(body.certifications) ? body.certifications : undefined,
              material: typeof body.material === "string" ? body.material : undefined,
              minOrder: typeof body.minOrder === "string" ? body.minOrder : undefined,
              moq: typeof body.moq === "number" ? body.moq : undefined,
              moqBags: typeof body.moqBags === "number" ? body.moqBags : undefined,
              note: typeof body.note === "string" ? body.note : undefined,
              listNotes: typeof body.listNotes === "string" ? body.listNotes : undefined,
              alternateSkus: Array.isArray(body.alternateSkus) ? body.alternateSkus : undefined,
              discountTiers: Array.isArray(body.discountTiers) ? body.discountTiers : undefined,
              sizes: Array.isArray(body.sizes) ? body.sizes : undefined,
              sellers: Array.isArray(body.sellers) ? body.sellers : undefined,
              pricing: {
                basicPrice: pricing.basicPrice,
                priceWithGst: pricing.priceWithGst,
                currency: typeof pricing.currency === "string" ? pricing.currency : "INR",
                priceListEffectiveDate: pricing.priceListEffectiveDate
                  ? new Date(String(pricing.priceListEffectiveDate))
                  : undefined,
              },
              packaging:
                typeof body.packaging === "object" && body.packaging !== null ? body.packaging : {},
              isActive: typeof body.isActive === "boolean" ? body.isActive : true,
              isEligibleForCombo:
                typeof body.isEligibleForCombo === "boolean" ? body.isEligibleForCombo : null,
              sourceDocument:
                typeof body.sourceDocument === "string" ? body.sourceDocument : "RPT PRICE LIST",
              legacyId: typeof body.legacyId === "number" ? body.legacyId : undefined,
            },
          ] as never,
          { session }
        )) as unknown as { _id: mongoose.Types.ObjectId }[];
        doc = { _id: createdArr[0]._id };
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("pricing")) {
        return err(e.message, 400);
      }
      throw e;
    } finally {
      await session.endSession();
    }

    const populated = await ProductModel.findById(doc._id).populate("category", "name slug").lean();
    return NextResponse.json({
      data: serializeProductLean(populated as Parameters<typeof serializeProductLean>[0]),
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
      return err("Duplicate key (e.g. SKU or slug already exists)", 409);
    }
    return serverFetchError(e);
  }
}
