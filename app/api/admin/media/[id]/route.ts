import { NextRequest, NextResponse } from "next/server";
import {
  destroyImage,
  getImageResource,
  isCloudinaryConfigured,
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!isCloudinaryConfigured()) return unavailable();
  try {
    const { id } = await ctx.params;
    const publicId = decodeURIComponent(id);
    const data = await getImageResource(publicId);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return NextResponse.json({ message }, { status: 404 });
  }
}

export async function PATCH() {
  return NextResponse.json({ message: "Not supported for direct Cloudinary uploads" }, { status: 405 });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!isCloudinaryConfigured()) return unavailable();
  try {
    const { id } = await ctx.params;
    const publicId = decodeURIComponent(id);
    await destroyImage(publicId);
    return NextResponse.json({ data: { public_id: publicId, deleted: true } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
