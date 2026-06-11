import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { serverFetchError } from "@/lib/http/apiError";
import { revalidateStorefrontAfterPriceChange } from "@/lib/catalog/revalidateStorefront";
import { parseBulkCreateWorkbook } from "@/lib/products/bulkCreateExcel";
import {
  createProductsFromBulkRows,
  loadCategoryLookup,
  resolveDefaultCategoryId,
} from "@/lib/products/bulkCreateProduct";

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

    const defaultCategoryId = await resolveDefaultCategoryId();
    if (!defaultCategoryId) {
      return err("No active category found. Create a category before bulk import.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors, skippedRows } = parseBulkCreateWorkbook(buffer);

    if (parseErrors.length > 0 && rows.length === 0) {
      return err("No valid rows to import", 400, { errors: parseErrors, skippedRows });
    }

    if (rows.length === 0) {
      return err("Spreadsheet contains no product rows", 400, { skippedRows, errors: parseErrors });
    }

    const categoryLookup = await loadCategoryLookup();
    const { createdCount, createdIds, rowErrors } = await createProductsFromBulkRows(
      rows,
      categoryLookup,
      defaultCategoryId
    );

    const allRowErrors = [...parseErrors, ...rowErrors];

    if (createdCount === 0) {
      return err("No products were created", 400, {
        errors: allRowErrors,
        skippedRows,
      });
    }

    if (createdCount > 0) {
      revalidateStorefrontAfterPriceChange();
    }

    return NextResponse.json({
      data: {
        requested: rows.length,
        createdCount,
        createdIds,
        skippedRows,
        rowErrors: allRowErrors,
        failedCount: rows.length - createdCount,
        rowsUsingDefaultCategory: rows.filter((r) => !r.category.trim()).length,
      },
    });
  } catch (e) {
    return serverFetchError(e, 500, { route: "POST /api/admin/products/bulk-create" });
  }
}
