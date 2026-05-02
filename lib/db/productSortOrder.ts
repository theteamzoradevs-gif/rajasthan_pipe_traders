import mongoose from "mongoose";
import { ProductModel } from "@/lib/db/models/Product";
import { parseSortOrderInput } from "@/lib/db/categorySortOrder";

export { parseSortOrderInput };

export async function findProductSortOrderConflict(
  categoryId: mongoose.Types.ObjectId,
  sortOrder: number,
  excludeProductId?: mongoose.Types.ObjectId | string | null
) {
  const q: Record<string, unknown> = { category: categoryId, sortOrder };
  if (excludeProductId) {
    const ex =
      typeof excludeProductId === "string"
        ? new mongoose.Types.ObjectId(excludeProductId)
        : excludeProductId;
    q._id = { $ne: ex };
  }
  return ProductModel.findOne(q).select("_id name sortOrder").lean();
}

export async function findGlobalProductSortOrderConflict(
  sortOrder: number,
  excludeProductId?: mongoose.Types.ObjectId | string | null
) {
  const q: Record<string, unknown> = { sortOrder };
  if (excludeProductId) {
    const ex =
      typeof excludeProductId === "string"
        ? new mongoose.Types.ObjectId(excludeProductId)
        : excludeProductId;
    q._id = { $ne: ex };
  }
  return ProductModel.findOne(q).select("_id name sortOrder").lean();
}

export async function maxSortOrderInCategory(
  categoryId: mongoose.Types.ObjectId
): Promise<number> {
  const doc = await ProductModel.findOne({ category: categoryId })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  return typeof doc?.sortOrder === "number" ? doc.sortOrder : 0;
}

export async function maxCategorySortOrderInCategory(
  categoryId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null
): Promise<number> {
  let q = ProductModel.findOne({ category: categoryId })
    .sort({ categorySortOrder: -1 })
    .select("categorySortOrder");
  if (session) q = q.session(session);
  const doc = await q.lean();
  return typeof doc?.categorySortOrder === "number" ? doc.categorySortOrder : 0;
}

export async function maxSortOrderInProducts(
  session?: mongoose.ClientSession | null
): Promise<number> {
  let q = ProductModel.findOne({}).sort({ sortOrder: -1 }).select("sortOrder");
  if (session) q = q.session(session);
  const doc = await q.lean();
  return typeof doc?.sortOrder === "number" ? doc.sortOrder : 0;
}

/** Products with missing / null / non-positive sortOrder get unique tail values (same session). */
export async function normalizeNonPositiveProductSortOrders(
  session: mongoose.ClientSession
): Promise<void> {
  const maxSo = await maxSortOrderInProducts(session);
  let slot = maxSo + 1;
  const bad = await ProductModel.find({
    $or: [{ sortOrder: null }, { sortOrder: { $lte: 0 } }],
  })
    .sort({ name: 1, _id: 1 })
    .select("_id")
    .session(session)
    .lean();

  for (const row of bad) {
    await ProductModel.updateOne({ _id: row._id }, { $set: { sortOrder: slot } }, { session });
    slot += 1;
  }
}

/** Global list: shift every product up by one (frees sortOrder 1 for a new “top” product). */
export async function bumpAllProductSortOrdersByOne(
  session: mongoose.ClientSession
): Promise<void> {
  await ProductModel.updateMany({}, { $inc: { sortOrder: 1 } }, { session });
}

/** Category-scoped list: shift all products in that category up by one (frees slot 1). */
export async function bumpCategoryProductSortOrdersByOne(
  categoryId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<void> {
  await ProductModel.updateMany({ category: categoryId }, { $inc: { categorySortOrder: 1 } }, { session });
}

/** Products with missing / null / non-positive categorySortOrder get unique tail values in that category. */
export async function normalizeNonPositiveCategoryProductSortOrders(
  categoryId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<void> {
  const maxSo = await maxCategorySortOrderInCategory(categoryId, session);
  let slot = maxSo + 1;
  const bad = await ProductModel.find({
    category: categoryId,
    $or: [{ categorySortOrder: null }, { categorySortOrder: { $lte: 0 } }],
  })
    .sort({ name: 1, _id: 1 })
    .select("_id")
    .session(session)
    .lean();
  for (const row of bad) {
    await ProductModel.updateOne({ _id: row._id }, { $set: { categorySortOrder: slot } }, { session });
    slot += 1;
  }
}

export function productSortOrderConflictPayload(conflict: {
  _id: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
}) {
  return {
    message: "Another product already uses this sort order in the product list.",
    code: "SORT_ORDER_CONFLICT" as const,
    conflict: {
      _id: String(conflict._id),
      name: conflict.name,
      sortOrder: conflict.sortOrder,
    },
  };
}
