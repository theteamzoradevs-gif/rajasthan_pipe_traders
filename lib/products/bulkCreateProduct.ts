import mongoose from "mongoose";
import { CategoryModel } from "@/lib/db/models/Category";
import { ProductModel } from "@/lib/db/models/Product";
import { ensureUniqueProductSlug } from "@/lib/product/ensureUniqueProductSlug";
import type { ParsedBulkCreateRow } from "@/lib/products/bulkCreateExcel";

export type BulkCreateRowError = { row: number; message: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugFromProductName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function findProductDuplicateByNameBrand(params: {
  name: string;
  brand: string;
}): Promise<boolean> {
  const nameRx = new RegExp(`^${escapeRegex(params.name)}$`, "i");
  const brandTrim = params.brand.trim();
  if (brandTrim) {
    const brandRx = new RegExp(`^${escapeRegex(brandTrim)}$`, "i");
    const row = await ProductModel.findOne({ name: nameRx, brand: brandRx }).select("_id").lean();
    return row != null;
  }
  const row = await ProductModel.findOne({ name: nameRx }).select("_id").lean();
  return row != null;
}

export type CategoryLookup = {
  bySlug: Map<string, mongoose.Types.ObjectId>;
  byName: Map<string, mongoose.Types.ObjectId>;
};

export async function loadCategoryLookup(): Promise<CategoryLookup> {
  const categories = await CategoryModel.find({ isActive: true })
    .select("_id slug name")
    .lean();
  const bySlug = new Map<string, mongoose.Types.ObjectId>();
  const byName = new Map<string, mongoose.Types.ObjectId>();
  for (const cat of categories) {
    const slug = typeof cat.slug === "string" ? cat.slug.trim().toLowerCase() : "";
    const name = typeof cat.name === "string" ? cat.name.trim().toLowerCase() : "";
    if (slug) bySlug.set(slug, cat._id as mongoose.Types.ObjectId);
    if (name && !byName.has(name)) {
      byName.set(name, cat._id as mongoose.Types.ObjectId);
    }
  }
  return { bySlug, byName };
}

export function resolveCategoryIdFromExcel(
  categoryKey: string,
  lookup: CategoryLookup
): mongoose.Types.ObjectId | null {
  const key = categoryKey.trim().toLowerCase();
  if (!key) return null;
  return lookup.byName.get(key) ?? lookup.bySlug.get(key) ?? null;
}

export async function resolveDefaultCategoryId(): Promise<mongoose.Types.ObjectId | null> {
  const cat = await CategoryModel.findOne({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select("_id")
    .lean();
  return cat ? (cat._id as mongoose.Types.ObjectId) : null;
}

export function buildMinimalCatalogProduct(params: {
  name: string;
  brand: string;
  basicPrice: number;
  priceWithGst: number;
  slug: string;
  categoryId: mongoose.Types.ObjectId;
}) {
  const { name, brand, basicPrice, priceWithGst, slug, categoryId } = params;
  const effectiveDate = new Date();

  return {
    name,
    brand,
    productKind: "catalog" as const,
    slug,
    category: categoryId,
    sortOrder: 0,
    categorySortOrder: 0,
    sizeOrModel: "Standard",
    isActive: true,
    isNew: false,
    isIsiCertified: false,
    isEligibleForCombo: null,
    sourceDocument: "RPT PRICE LIST",
    pricing: {
      basicPrice,
      priceWithGst,
      currency: "INR",
      priceListEffectiveDate: effectiveDate,
    },
    sizes: [
      {
        size: "Standard",
        basicPrice,
        priceWithGst,
        pcsPerPacket: 1,
        qtyPerBag: 0,
      },
    ],
    sellers: [],
    packaging: {
      pricingUnit: "per_piece" as const,
      pcsPerPacket: 1,
    },
  };
}

export async function createProductsFromBulkRows(
  parsedRows: ParsedBulkCreateRow[],
  categoryLookup: CategoryLookup,
  defaultCategoryId: mongoose.Types.ObjectId
): Promise<{
  createdCount: number;
  createdIds: string[];
  rowErrors: BulkCreateRowError[];
}> {
  const rowErrors: BulkCreateRowError[] = [];
  const pending: { rowNumber: number; doc: ReturnType<typeof buildMinimalCatalogProduct> }[] =
    [];

  for (const row of parsedRows) {
    let categoryId = defaultCategoryId;
    if (row.category.trim()) {
      const resolved = resolveCategoryIdFromExcel(row.category, categoryLookup);
      if (!resolved) {
        rowErrors.push({
          row: row.rowNumber,
          message: `Unknown category: ${row.category} (use exact category name from Categories sheet)`,
        });
        continue;
      }
      categoryId = resolved;
    }

    const isDuplicate = await findProductDuplicateByNameBrand({
      name: row.name,
      brand: row.brand,
    });
    if (isDuplicate) {
      rowErrors.push({
        row: row.rowNumber,
        message: `Product already exists: ${row.name} (${row.brand})`,
      });
      continue;
    }

    const baseSlug = slugFromProductName(row.name);
    if (!baseSlug) {
      rowErrors.push({ row: row.rowNumber, message: "Could not generate slug from name" });
      continue;
    }

    let slug: string;
    try {
      const resolved = await ensureUniqueProductSlug(baseSlug);
      if (!resolved) {
        rowErrors.push({ row: row.rowNumber, message: "Could not generate unique slug" });
        continue;
      }
      slug = resolved;
    } catch {
      rowErrors.push({ row: row.rowNumber, message: "Could not generate unique slug" });
      continue;
    }

    pending.push({
      rowNumber: row.rowNumber,
      doc: buildMinimalCatalogProduct({
        name: row.name,
        brand: row.brand,
        basicPrice: row.basicPrice,
        priceWithGst: row.priceWithGst,
        slug,
        categoryId,
      }),
    });
  }

  if (pending.length === 0) {
    return { createdCount: 0, createdIds: [], rowErrors };
  }

  const createdIds: string[] = [];

  for (const item of pending) {
    try {
      const created = await ProductModel.create(item.doc);
      createdIds.push(String(created._id));
    } catch (e) {
      if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
        rowErrors.push({
          row: item.rowNumber,
          message: "Duplicate key (SKU or slug already exists)",
        });
        continue;
      }
      const message = e instanceof Error ? e.message : "Insert failed";
      rowErrors.push({ row: item.rowNumber, message });
    }
  }

  return {
    createdCount: createdIds.length,
    createdIds,
    rowErrors,
  };
}
