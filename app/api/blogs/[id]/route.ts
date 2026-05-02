import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { MONGO_MAX_TIME_MS } from "@/lib/db/mongoTimeout";
import { logApiRouteError } from "@/lib/http/apiError";
import { BlogModel } from "@/lib/db/models/Blog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return err("Invalid blog id", 400);
    }

    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.content === "string") updates.content = body.content;
    if (typeof body.image === "string") updates.image = body.image.trim();
    if (typeof body.author === "string") updates.author = body.author.trim();
    if (typeof body.createdAt === "string") {
      const createdAt = new Date(body.createdAt.trim());
      if (Number.isNaN(createdAt.getTime())) {
        return err("Invalid createdAt date", 400);
      }
      updates.createdAt = createdAt;
    }

    if (!Object.keys(updates).length) {
      return err("No valid fields provided for update", 400);
    }

    const updatedBlog = await BlogModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
      maxTimeMS: MONGO_MAX_TIME_MS,
    }).lean();

    if (!updatedBlog) {
      return err("Blog not found", 404);
    }

    return NextResponse.json({
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return err("slug already exists", 409);
    }
    logApiRouteError("PUT /api/blogs/[id]", error);
    return err("Failed to update blog", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await req.json().catch(() => null);

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return err("Invalid blog id", 400);
    }

    await connectDb();
    const deletedBlog = await BlogModel.findByIdAndDelete(id, { maxTimeMS: MONGO_MAX_TIME_MS }).lean();

    if (!deletedBlog) {
      return err("Blog not found", 404);
    }

    return NextResponse.json({
      message: "Blog deleted successfully",
    });
  } catch (error) {
    logApiRouteError("DELETE /api/blogs/[id]", error);
    return err("Failed to delete blog", 500);
  }
}
