import { NextRequest, NextResponse } from "next/server";
import { getStorefrontProductsFromSearchParams } from "@/lib/catalog/storefront";
import { serverFetchError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clientMessage(message: string, status: number) {
  return NextResponse.json({ error: "Failed to fetch data", details: message, message }, { status });
}

/** Public catalog: active products only (storefront). */
export async function GET(req: NextRequest) {
  try {
    const result = await getStorefrontProductsFromSearchParams(req.nextUrl.searchParams);
    if (!result.ok) {
      return clientMessage(result.message, result.status);
    }
    return NextResponse.json({
      data: result.data,
      meta: result.meta,
    });
  } catch (e) {
    return serverFetchError(e, 500, { route: "GET /api/products" });
  }
}
