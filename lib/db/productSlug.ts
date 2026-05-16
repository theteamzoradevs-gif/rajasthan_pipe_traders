import mongoose from "mongoose";
import { ProductModel } from "@/lib/db/models/Product";

export async function findProductSlugConflict(
  slug: string,
  excludeProductId?: mongoose.Types.ObjectId | string | null
) {
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const q: Record<string, unknown> = { slug: normalized };
  if (excludeProductId) {
    const ex =
      typeof excludeProductId === "string"
        ? new mongoose.Types.ObjectId(excludeProductId)
        : excludeProductId;
    q._id = { $ne: ex };
  }
  return ProductModel.findOne(q).select("_id name slug").lean();
}

export function productSlugConflictPayload(
  conflict: { _id: mongoose.Types.ObjectId; name: string; slug?: string },
  slug: string
) {
  return {
    message: `Another product already uses the URL slug “${slug}”.`,
    code: "SLUG_CONFLICT" as const,
    slug,
    conflict: {
      _id: String(conflict._id),
      name: conflict.name,
      slug: typeof conflict.slug === "string" ? conflict.slug : slug,
    },
  };
}
