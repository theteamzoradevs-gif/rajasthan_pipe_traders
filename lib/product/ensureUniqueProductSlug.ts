import crypto from "crypto";
import mongoose from "mongoose";
import { ProductModel } from "@/lib/db/models/Product";

/**
 * Resolves a storefront-safe slug: if `base` is empty/undefined, returns undefined (sparse index).
 * If another product already uses the slug, appends a short random suffix until unique.
 */
export async function ensureUniqueProductSlug(
  base: string | undefined,
  opts?: { excludeProductId?: string }
): Promise<string | undefined> {
  if (base === undefined || base === null) return undefined;
  const trimmed = String(base).trim().toLowerCase();
  if (!trimmed) return undefined;

  const slugTaken = async (slug: string): Promise<boolean> => {
    const exclude =
      opts?.excludeProductId && mongoose.Types.ObjectId.isValid(opts.excludeProductId)
        ? new mongoose.Types.ObjectId(opts.excludeProductId)
        : undefined;
    const doc = await ProductModel.findOne(
      exclude ? { slug, _id: { $ne: exclude } } : { slug }
    )
      .select("_id")
      .lean();
    return doc != null;
  };

  let candidate = trimmed;
  if (!(await slugTaken(candidate))) return candidate;

  for (let i = 0; i < 24; i++) {
    const suffix = crypto.randomBytes(3).toString("hex");
    candidate = `${trimmed}-${suffix}`;
    if (!(await slugTaken(candidate))) return candidate;
  }

  throw new Error("Could not generate a unique slug after multiple attempts");
}
