import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import {
  findGlobalProductSortOrderConflict,
  parseSortOrderInput,
} from "@/lib/db/productSortOrder";
import { serverFetchError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * POST — checks whether a sort order is free in whole product list.
 * Body: { sortOrder: number, excludeProductId?: string }
 * Response: { available: true } or { available: false, conflict: { _id, name, sortOrder } }
 */
export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;

    const sortOrder = parseSortOrderInput(body.sortOrder);
    if (sortOrder <= 0) {
      return NextResponse.json({ available: true });
    }

    const excludeRaw =
      typeof body.excludeProductId === "string" ? body.excludeProductId.trim() : "";
    const exclude =
      excludeRaw && mongoose.Types.ObjectId.isValid(excludeRaw)
        ? excludeRaw
        : null;

    const conflict = await findGlobalProductSortOrderConflict(sortOrder, exclude);

    if (!conflict) {
      return NextResponse.json({ available: true });
    }

    return NextResponse.json({
      available: false,
      conflict: {
        _id: String(conflict._id),
        name: conflict.name,
        sortOrder: conflict.sortOrder,
      },
    });
  } catch (e) {
    return serverFetchError(e);
  }
}
