import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { serverFetchError } from "@/lib/http/apiError";
import { revalidateStorefrontAfterPriceChange } from "@/lib/catalog/revalidateStorefront";
import { parseBulkPriceWorkbook } from "@/lib/products/bulkPriceExcel";
import { buildBulkPriceBulkWriteOp } from "@/lib/products/bulkPriceWrite";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function err(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return err("Missing file field in FormData", 400);
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return err("Only .xlsx or .xls files are supported", 400);
    }

    if (file.size === 0) {
      return err("Uploaded file is empty", 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return err(`File exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { updates, errors, skippedRows } = parseBulkPriceWorkbook(buffer);

    if (errors.length > 0 && updates.length === 0) {
      return err("No valid rows to update", 400, {
        errors,
        skippedRows,
      });
    }

    if (updates.length === 0) {
      return err("Spreadsheet contains no price updates", 400, { skippedRows });
    }

    const bulkOps = updates.map((update) => buildBulkPriceBulkWriteOp(update));

    const result = await ProductModel.bulkWrite(bulkOps, { ordered: false });

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      revalidateStorefrontAfterPriceChange();
    }

    return NextResponse.json({
      data: {
        requested: updates.length,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        skippedRows,
        rowErrors: errors,
        notFoundCount: Math.max(0, updates.length - result.matchedCount),
      },
    });
  } catch (e) {
    return serverFetchError(e, 500, { route: "POST /api/admin/products/bulk-price-update" });
  }
}
