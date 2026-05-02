import mongoose from "mongoose";
import { CategoryModel } from "@/lib/db/models/Category";

export function parseSortOrderInput(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return 0;
}

/** Query filter for categories under the same parent (null = root). */
export function parentQueryFilter(parent: mongoose.Types.ObjectId | null) {
  if (parent === null) return { parent: null };
  return { parent };
}

export async function findSortOrderConflict(
  parent: mongoose.Types.ObjectId | null,
  sortOrder: number,
  excludeId?: mongoose.Types.ObjectId | string | null
) {
  const q: Record<string, unknown> = { ...parentQueryFilter(parent), sortOrder };
  if (excludeId) {
    const ex =
      typeof excludeId === "string" ? new mongoose.Types.ObjectId(excludeId) : excludeId;
    q._id = { $ne: ex };
  }
  return CategoryModel.findOne(q).select("_id name sortOrder").lean();
}

export async function maxSortOrderInParent(parent: mongoose.Types.ObjectId | null): Promise<number> {
  const doc = await CategoryModel.findOne({ ...parentQueryFilter(parent) })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();
  return typeof doc?.sortOrder === "number" ? doc.sortOrder : 0;
}

/** Categories with missing / null / non-positive sortOrder get unique tail values in the same parent group. */
export async function normalizeNonPositiveCategorySortOrders(
  parent: mongoose.Types.ObjectId | null,
  session: mongoose.ClientSession
): Promise<void> {
  const parentFilter = parentQueryFilter(parent);
  const doc = await CategoryModel.findOne({ ...parentFilter })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .session(session)
    .lean();
  const maxSo = typeof doc?.sortOrder === "number" ? doc.sortOrder : 0;
  let slot = maxSo + 1;
  const bad = await CategoryModel.find({
    ...parentFilter,
    $or: [{ sortOrder: null }, { sortOrder: { $lte: 0 } }],
  })
    .sort({ name: 1, _id: 1 })
    .select("_id")
    .session(session)
    .lean();
  for (const row of bad) {
    await CategoryModel.updateOne({ _id: row._id }, { $set: { sortOrder: slot } }, { session });
    slot += 1;
  }
}

/** Parent group list: shift each sibling category up by one (frees slot 1). */
export async function bumpSiblingCategorySortOrdersByOne(
  parent: mongoose.Types.ObjectId | null,
  session: mongoose.ClientSession
): Promise<void> {
  await CategoryModel.updateMany({ ...parentQueryFilter(parent) }, { $inc: { sortOrder: 1 } }, { session });
}

export function sortOrderConflictPayload(conflict: {
  _id: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
}) {
  return {
    message: "Another category already uses this sort order in the same group.",
    code: "SORT_ORDER_CONFLICT" as const,
    conflict: {
      _id: String(conflict._id),
      name: conflict.name,
      sortOrder: conflict.sortOrder,
    },
  };
}
