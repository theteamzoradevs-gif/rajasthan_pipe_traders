import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import {
  bumpSiblingCategorySortOrdersByOne,
  findSortOrderConflict,
  maxSortOrderInParent,
  normalizeNonPositiveCategorySortOrders,
  parseSortOrderInput,
  sortOrderConflictPayload,
} from "@/lib/db/categorySortOrder";
import { CategoryModel } from "@/lib/db/models/Category";
import { serializeCategoryLean } from "@/lib/db/serialize";
import { serverFetchError } from "@/lib/http/apiError";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}


export async function GET(req: NextRequest) {
  try {
    await connectDb();
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") !== "false";
    const filter = includeInactive ? {} : { isActive: true };
    const rows = await CategoryModel.find(filter)
      .populate("parent", "name slug")
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    const data = rows.map((r) => serializeCategoryLean(r as Parameters<typeof serializeCategoryLean>[0])!);
    return NextResponse.json({ data });
  } catch (e) {
    return serverFetchError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slugRaw = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!name || !slugRaw) {
      return err("name and slug are required", 400);
    }
    const parentId = body.parent;
    let parent: mongoose.Types.ObjectId | null = null;
    if (parentId && typeof parentId === "string" && mongoose.Types.ObjectId.isValid(parentId)) {
      parent = new mongoose.Types.ObjectId(parentId);
    }
    const image =
      typeof body.image === "string" && body.image.trim() ? body.image.trim() : undefined;
    const sortOrder = parseSortOrderInput(body.sortOrder);
    const swapWithRaw =
      typeof body.swapSortOrderWith === "string" ? body.swapSortOrderWith.trim() : "";

    const conflict = await findSortOrderConflict(parent, sortOrder, null);
    if (conflict) {
      if (
        swapWithRaw &&
        mongoose.Types.ObjectId.isValid(swapWithRaw) &&
        swapWithRaw === String(conflict._id)
      ) {
        const session = await mongoose.startSession();
        let doc;
        try {
          await session.withTransaction(async () => {
            const maxSo = await maxSortOrderInParent(parent);
            await CategoryModel.updateOne(
              { _id: conflict._id },
              { $set: { sortOrder: maxSo + 1 } },
              { session }
            );
            const [created] = await CategoryModel.create(
              [
                {
                  name,
                  slug: slugRaw,
                  image,
                  description: typeof body.description === "string" ? body.description : undefined,
                  parent,
                  sortOrder,
                  sourceSectionLabel:
                    typeof body.sourceSectionLabel === "string"
                      ? body.sourceSectionLabel
                      : undefined,
                  isActive: typeof body.isActive === "boolean" ? body.isActive : true,
                },
              ],
              { session }
            );
            doc = created;
          });
        } finally {
          await session.endSession();
        }
        const populated = await CategoryModel.findById(doc!._id)
          .populate("parent", "name slug")
          .lean();
        return NextResponse.json({
          data: serializeCategoryLean(populated as Parameters<typeof serializeCategoryLean>[0]),
        });
      }
      return NextResponse.json(
        sortOrderConflictPayload(conflict as { _id: mongoose.Types.ObjectId; name: string; sortOrder: number }),
        { status: 409 }
      );
    }

    const session = await mongoose.startSession();
    let doc!: { _id: mongoose.Types.ObjectId };
    try {
      await session.withTransaction(async () => {
        await normalizeNonPositiveCategorySortOrders(parent, session);
        await bumpSiblingCategorySortOrdersByOne(parent, session);
        const createdArr = (await CategoryModel.create(
          [
            {
              name,
              slug: slugRaw,
              image,
              description: typeof body.description === "string" ? body.description : undefined,
              parent,
              sortOrder: 1,
              sourceSectionLabel:
                typeof body.sourceSectionLabel === "string" ? body.sourceSectionLabel : undefined,
              isActive: typeof body.isActive === "boolean" ? body.isActive : true,
            },
          ] as never,
          { session }
        )) as unknown as { _id: mongoose.Types.ObjectId }[];
        doc = { _id: createdArr[0]._id };
      });
    } finally {
      await session.endSession();
    }
    const populated = await CategoryModel.findById(doc._id).populate("parent", "name slug").lean();
    return NextResponse.json({
      data: serializeCategoryLean(populated as Parameters<typeof serializeCategoryLean>[0]),
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) {
      return err("A category with this slug already exists", 409);
    }
    return serverFetchError(e);
  }
}
