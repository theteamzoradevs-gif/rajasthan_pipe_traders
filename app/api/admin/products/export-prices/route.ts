import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { serverFetchError } from "@/lib/http/apiError";
import {
  buildBulkPriceWorkbook,
  type BulkPriceExportRow,
  workbookToBuffer,
} from "@/lib/products/bulkPriceExcel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `product-prices-${date}.xlsx`;
}

export async function GET() {
  try {
    await connectDb();

    const rows = await ProductModel.find({})
      .select("_id sku name category pricing.basicPrice pricing.priceWithGst")
      .populate("category", "name")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const exportRows: BulkPriceExportRow[] = rows.map((row) => {
      const category =
        row.category && typeof row.category === "object" && "name" in row.category
          ? String((row.category as { name?: string }).name ?? "")
          : "";
      return {
        product_id: String(row._id),
        sku: row.sku ?? "",
        name: row.name ?? "",
        category,
        price: row.pricing?.priceWithGst ?? 0,
        basic_price: row.pricing?.basicPrice ?? 0,
      };
    });

    const workbook = buildBulkPriceWorkbook(exportRows);
    const buffer = workbookToBuffer(workbook);
    const filename = exportFilename();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverFetchError(e, 500, { route: "GET /api/admin/products/export-prices" });
  }
}
