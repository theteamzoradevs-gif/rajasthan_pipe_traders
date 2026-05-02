import { NextRequest, NextResponse } from "next/server";
import {
  isCloudinaryConfigured,
  listImages,
  uploadImageFromBuffer,
} from "@/lib/cloudinary-server";

export const runtime = "nodejs";

function unavailable() {
  return NextResponse.json(
    {
      message:
        "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.local.",
    },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  if (!isCloudinaryConfigured()) return unavailable();
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    const cursor = sp.get("cursor")?.trim() || undefined;
    const kind = sp.get("kind")?.trim();
    const kindPrefix =
      kind === "product" || kind === "category" || kind === "banner" ? kind : null;
    const { items, nextCursor } = await listImages({ limit, cursor, kindPrefix });
    return NextResponse.json({
      data: items,
      meta: { nextCursor },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list media";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isCloudinaryConfigured()) return unavailable();
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "Missing file field" }, { status: 400 });
    }
    const kindRaw = formData.get("kind");
    const kind = typeof kindRaw === "string" && kindRaw.trim() ? kindRaw.trim() : "product";
    if (kind !== "product" && kind !== "category" && kind !== "banner") {
      return NextResponse.json(
        { message: "kind must be product, category, or banner" },
        { status: 400 }
      );
    }
    const productIdVal = formData.get("productId");
    const categoryIdVal = formData.get("categoryId");
    const productId = typeof productIdVal === "string" ? productIdVal : undefined;
    const categoryId = typeof categoryIdVal === "string" ? categoryIdVal : undefined;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "image/jpeg";
    const { secure_url, public_id } = await uploadImageFromBuffer({
      buffer,
      mime,
      kind,
      productId,
      categoryId,
    });
    return NextResponse.json({
      data: {
        secure_url,
        public_id,
        url: secure_url,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
