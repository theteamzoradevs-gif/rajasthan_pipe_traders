import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db/connect";
import { CategoryModel } from "@/lib/db/models/Category";
import { serverFetchError } from "@/lib/http/apiError";
import {
  buildBulkCreateTemplateWorkbook,
  bulkCreateWorkbookToBuffer,
} from "@/lib/products/bulkCreateExcel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDb();

    const categories = await CategoryModel.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select("name")
      .lean();

    const categoryNames = categories
      .map((c) => (typeof c.name === "string" ? c.name.trim() : ""))
      .filter(Boolean);

    const exampleCategoryName = categoryNames[0] ?? "";

    const workbook = buildBulkCreateTemplateWorkbook(exampleCategoryName, categoryNames);
    const buffer = bulkCreateWorkbookToBuffer(workbook);
    const filename = "bulk-product-import-template.xlsx";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverFetchError(e, 500, { route: "GET /api/admin/products/bulk-create-template" });
  }
}
