import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { BlogModel } from "@/lib/db/models/Blog";
import { logApiRouteError } from "@/lib/http/apiError";
import { MONGO_MAX_TIME_MS } from "@/lib/db/mongoTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET() {
  try {
    await connectDb();
    const blogs = await BlogModel.find({}).sort({ createdAt: -1 }).maxTimeMS(MONGO_MAX_TIME_MS).lean();
    return NextResponse.json({ data: blogs }, { status: 200 });
  } catch (error) {
    logApiRouteError("GET /api/blogs", error);
    return err("Failed to fetch blogs", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    const image = typeof body.image === "string" ? body.image.trim() : undefined;
    const author = typeof body.author === "string" ? body.author.trim() : undefined;
    const createdAtRaw = typeof body.createdAt === "string" ? body.createdAt.trim() : "";
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : undefined;

    if (!title || !content) {
      return err("title and content are required", 400);
    }
    if (createdAt && Number.isNaN(createdAt.getTime())) {
      return err("Invalid createdAt date", 400);
    }

    const blog = await BlogModel.create({
      title,
      content,
      image,
      author,
      createdAt,
    });

    return NextResponse.json({ data: blog }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return err("slug already exists", 409);
    }
    logApiRouteError("POST /api/blogs", error);
    return err("Failed to create blog", 500);
  }
}
