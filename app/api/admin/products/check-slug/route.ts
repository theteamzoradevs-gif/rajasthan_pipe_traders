import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { findProductSlugConflict } from "@/lib/db/productSlug";
import { serverFetchError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * POST — checks whether a storefront slug is free.
 * Body: { slug: string, excludeProductId?: string }
 * Response: { available: true } or { available: false, conflict: { _id, name, slug } }
 */
export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!slug) {
      return err("slug is required", 400);
    }

    const excludeRaw =
      typeof body.excludeProductId === "string" ? body.excludeProductId.trim() : "";
    const exclude =
      excludeRaw && mongoose.Types.ObjectId.isValid(excludeRaw) ? excludeRaw : null;

    const conflict = await findProductSlugConflict(slug, exclude);

    if (!conflict) {
      return NextResponse.json({ available: true, slug });
    }

    return NextResponse.json({
      available: false,
      slug,
      conflict: {
        _id: String(conflict._id),
        name: conflict.name,
        slug: typeof conflict.slug === "string" ? conflict.slug : slug,
      },
    });
  } catch (e) {
    return serverFetchError(e);
  }
}
