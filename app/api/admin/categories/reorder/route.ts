import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { CategoryModel } from "@/lib/db/models/Category";
import { serverFetchError } from "@/lib/http/apiError";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const { ids } = (await req.json()) as { ids: string[] };

    if (!Array.isArray(ids)) {
      return NextResponse.json({ message: "ids array is required" }, { status: 400 });
    }

    const bulkOps = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index + 1 } },
      },
    }));

    if (bulkOps.length > 0) {
      await CategoryModel.bulkWrite(bulkOps);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return serverFetchError(e);
  }
}
