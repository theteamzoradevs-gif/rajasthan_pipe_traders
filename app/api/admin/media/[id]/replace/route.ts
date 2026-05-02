import { NextRequest, NextResponse } from "next/server";
import { isCloudinaryConfigured, replaceImageByPublicId } from "@/lib/cloudinary-server";

export const runtime = "nodejs";

function unavailable() {
  return NextResponse.json(
    {
      message:
        "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / CLOUDINARY_CLOUD_NAME in .env.local.",
    },
    { status: 503 }
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isCloudinaryConfigured()) return unavailable();
  try {
    const { id } = await ctx.params;
    const publicId = decodeURIComponent(id);
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "Missing file field" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "image/jpeg";
    const { secure_url, public_id } = await replaceImageByPublicId({
      buffer,
      mime,
      publicId,
    });
    return NextResponse.json({
      data: {
        secure_url,
        public_id,
        url: secure_url,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Replace failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
