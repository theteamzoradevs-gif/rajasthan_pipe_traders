import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { serverFetchError } from "@/lib/http/apiError";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const { updates, field } = (await req.json()) as { 
      updates: { id: string; sortOrder: number }[],
      field?: string 
    };

    if (!Array.isArray(updates)) {
      return NextResponse.json({ message: "updates array is required" }, { status: 400 });
    }

    const targetField = field === "categorySortOrder" ? "categorySortOrder" : "sortOrder";

    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.id },
        update: { $set: { [targetField]: update.sortOrder } },
      },
    }));

    if (bulkOps.length > 0) {
      await ProductModel.bulkWrite(bulkOps);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return serverFetchError(e);
  }
}
