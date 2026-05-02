import { NextResponse } from "next/server";
import { getStorefrontCategories } from "@/lib/catalog/storefront";
import { serverFetchError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public catalog: active categories only (storefront). */
export async function GET() {
  try {
    const data = await getStorefrontCategories();
    return NextResponse.json({ data });
  } catch (e) {
    return serverFetchError(e, 500, { route: "GET /api/categories" });
  }
}
