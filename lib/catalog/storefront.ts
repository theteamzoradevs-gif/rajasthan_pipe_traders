import { cache } from "react";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { MONGO_MAX_TIME_MS } from "@/lib/db/mongoTimeout";
import { CategoryModel } from "@/lib/db/models/Category";
import { ProductModel } from "@/lib/db/models/Product";
import { serializeCategoryLean, serializeProductLean } from "@/lib/db/serialize";
import { apiProductToProduct } from "@/app/lib/api/mapApiProduct";
import type { ApiProduct } from "@/app/lib/api/types";
import type { Product } from "@/app/data/products";

type LeanDoc = Record<string, unknown> & { _id: mongoose.Types.ObjectId };
const UNSET_SORT_ORDER = 2147483647;

/**
 * Product fields required for category/search listing + `apiProductToProduct` (excludes
 * long text blobs like longDescription, features, keyFeatures, etc.).
 */
const STOREFRONT_LISTING_PRODUCT_FIELDS: Record<string, 1> = {
  _id: 1,
  name: 1,
  slug: 1,
  sku: 1,
  legacyId: 1,
  productKind: 1,
  brand: 1,
  subCategory: 1,
  sortOrder: 1,
  sizeOrModel: 1,
  image: 1,
  images: 1,
  category: 1,
  pricing: 1,
  packaging: 1,
  sellers: 1,
  sizes: 1,
  discountTiers: 1,
  moq: 1,
  moqBags: 1,
  packingUnitLabels: 1,
  minOrder: 1,
  note: 1,
  isNew: 1,
  isIsiCertified: 1,
  isBestseller: 1,
  isActive: 1,
  isEligibleForCombo: 1,
};

const LISTING_MONGOOSE_SELECT = Object.keys(STOREFRONT_LISTING_PRODUCT_FIELDS).join(" ");

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Multi-token AND search across common catalog fields (each token must match at least one field). */
function applyProductTextSearch(filter: Record<string, unknown>, q: string): void {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return;

  const andClauses = tokens.map((token) => {
    const rx = escapeRegex(token);
    return {
      $or: [
        { name: { $regex: rx, $options: "i" } },
        { sku: { $regex: rx, $options: "i" } },
        { slug: { $regex: rx, $options: "i" } },
        { brand: { $regex: rx, $options: "i" } },
        { brandCode: { $regex: rx, $options: "i" } },
        { description: { $regex: rx, $options: "i" } },
        { longDescription: { $regex: rx, $options: "i" } },
        { subCategory: { $regex: rx, $options: "i" } },
        { sizeOrModel: { $regex: rx, $options: "i" } },
        { productLine: { $regex: rx, $options: "i" } },
        { material: { $regex: rx, $options: "i" } },
        { note: { $regex: rx, $options: "i" } },
        { listNotes: { $regex: rx, $options: "i" } },
        { tags: { $regex: rx, $options: "i" } },
        { alternateSkus: { $regex: rx, $options: "i" } },
        { certifications: { $regex: rx, $options: "i" } },
        { features: { $regex: rx, $options: "i" } },
      ],
    };
  });

  const existing = filter.$and;
  if (Array.isArray(existing)) {
    filter.$and = [...existing, ...andClauses];
  } else {
    filter.$and = andClauses;
  }
}

/**
 * Active product by URL slug: matches stored `slug` (case-insensitive), or derived slug
 * (e.g. catalog SKU-based) consistent with `apiProductToProduct`.
 */
export const getStorefrontProductBySlug = cache(async (slug: string) => {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  await connectDb();

  let row = await ProductModel.findOne({
    isActive: true,
    slug: { $regex: new RegExp(`^${escapeRegex(s)}$`, "i") },
  })
    .populate("category", "name slug")
    .maxTimeMS(MONGO_MAX_TIME_MS)
    .lean();

  if (!row) {
    const rows = await ProductModel.find({ isActive: true })
      .populate("category", "name slug")
      .sort({ sortOrder: 1, name: 1 })
      .limit(500)
      .maxTimeMS(MONGO_MAX_TIME_MS)
      .lean();
    for (const r of rows) {
      const ser = serializeProductLean(r as LeanDoc);
      if (!ser) continue;
      const p = apiProductToProduct(ser as unknown as ApiProduct);
      if (p.slug.toLowerCase() === s) {
        row = r;
        break;
      }
    }
  }

  if (!row) return null;
  return serializeProductLean(row as LeanDoc)!;
});

/** Other active products in the same category (storefront), excluding one id. */
export async function getStorefrontRelatedProducts(
  categoryMongoId: string | undefined,
  excludeProductMongoId: string,
  limit: number
): Promise<Product[]> {
  if (!categoryMongoId || !mongoose.Types.ObjectId.isValid(categoryMongoId)) return [];
  if (!mongoose.Types.ObjectId.isValid(excludeProductMongoId)) return [];
  await connectDb();
  const catId = new mongoose.Types.ObjectId(categoryMongoId);
  const exId = new mongoose.Types.ObjectId(excludeProductMongoId);
  const rows = await ProductModel.aggregate([
    { $match: { isActive: true, category: catId, _id: { $ne: exId } } },
    {
      $addFields: {
        _pSort: {
          $let: {
            vars: {
              catSo: { $ifNull: ["$categorySortOrder", 0] },
              so: { $ifNull: ["$sortOrder", 0] },
            },
            in: {
              $cond: [
                { $gt: ["$$catSo", 0] },
                "$$catSo",
                {
                  $cond: [{ $gt: ["$$so", 0] }, "$$so", UNSET_SORT_ORDER],
                },
              ],
            },
          },
        },
      },
    },
    { $sort: { _pSort: 1, name: 1 } },
    { $limit: limit },
  ]).exec();
  const populated = await ProductModel.populate(rows, { path: "category", select: "name slug" });
  return populated
    .map((r) => serializeProductLean(r as unknown as LeanDoc))
    .filter(Boolean)
    .map((ser) => apiProductToProduct(ser as unknown as ApiProduct));
}

export async function getStorefrontCategories() {
  await connectDb();
  const rows = await CategoryModel.find({ isActive: true })
    .select("name slug image description parent sortOrder isActive")
    .populate("parent", "name slug")
    .sort({ sortOrder: 1, name: 1 })
    .maxTimeMS(MONGO_MAX_TIME_MS)
    .lean();
  return rows.map((r) => serializeCategoryLean(r as LeanDoc)!);
}

/** Active category by slug (storefront). Cached per request for metadata + page. */
export const getStorefrontCategoryBySlug = cache(async (slug: string) => {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  await connectDb();
  const row = await CategoryModel.findOne({ slug: s, isActive: true })
    .select("name slug image description parent sortOrder isActive")
    .populate("parent", "name slug")
    .maxTimeMS(MONGO_MAX_TIME_MS)
    .lean();
  return serializeCategoryLean(row as LeanDoc | null);
});

export type StorefrontProductsResult =
  | {
      ok: true;
      data: NonNullable<ReturnType<typeof serializeProductLean>>[];
      meta: { total: number; limit: number; skip: number };
    }
  | { ok: false; status: number; message: string };

/** Storefront listing: active products only; same query semantics as GET /api/products. */
export async function getStorefrontProductsFromSearchParams(
  sp: URLSearchParams
): Promise<StorefrontProductsResult> {
  await connectDb();
  const filter: Record<string, unknown> = { isActive: true };
  const categorySlug = sp.get("categorySlug")?.trim().toLowerCase();
  const hasCategoryFilter = Boolean(categorySlug);
  if (categorySlug) {
    const cat = await CategoryModel.findOne({ slug: categorySlug })
      .select("_id")
      .maxTimeMS(MONGO_MAX_TIME_MS)
      .lean();
    if (!cat) {
      return { ok: false, status: 404, message: "No category matches categorySlug" };
    }
    filter.category = cat._id;
  }
  const productKind = sp.get("productKind");
  if (productKind === "sku" || productKind === "catalog") {
    filter.productKind = productKind;
  }
  const q = sp.get("q")?.trim() ?? "";
  if (q.length >= 2) {
    applyProductTextSearch(filter, q);
  }
  const brandParam = sp.get("brand")?.trim();
  if (brandParam) {
    filter.brand = { $regex: escapeRegex(brandParam), $options: "i" };
  }
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
  const skip = Math.max(0, Number(sp.get("skip")) || 0);

  const catColl = CategoryModel.collection.name;
  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter },
    {
      $lookup: {
        from: catColl,
        localField: "category",
        foreignField: "_id",
        as: "_catJoin",
      },
    },
    {
      $addFields: {
        _pSort: hasCategoryFilter
          ? {
              $let: {
                vars: {
                  catSo: { $ifNull: ["$categorySortOrder", 0] },
                  so: { $ifNull: ["$sortOrder", 0] },
                },
                in: {
                  $cond: [
                    { $gt: ["$$catSo", 0] },
                    "$$catSo",
                    {
                      $cond: [{ $gt: ["$$so", 0] }, "$$so", UNSET_SORT_ORDER],
                    },
                  ],
                },
              },
            }
          : {
              $let: {
                vars: { so: { $ifNull: ["$sortOrder", 0] } },
                in: {
                  $cond: [{ $gt: ["$$so", 0] }, "$$so", UNSET_SORT_ORDER],
                },
              },
            },
      },
    },
    { $sort: { _pSort: 1, name: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _catJoin: 0, _pSort: 0 } },
  ];

  const [rawRows, total] = await Promise.all([
    ProductModel.aggregate(pipeline, { allowDiskUse: true })
      .option({ maxTimeMS: MONGO_MAX_TIME_MS })
      .exec(),
    ProductModel.countDocuments(filter, { maxTimeMS: MONGO_MAX_TIME_MS }),
  ]);
  const rows = await ProductModel.populate(rawRows, {
    path: "category",
    select: "name slug",
  });
  const data = rows.map((r) => serializeProductLean(r as unknown as LeanDoc)!);
  return { ok: true, data, meta: { total, limit, skip } };
}
