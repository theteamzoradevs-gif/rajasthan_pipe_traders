import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { BannerSettingsModel } from "@/lib/db/models/BannerSettings";
import { DEFAULT_BANNER_COPY } from "@/lib/banner/defaults";
import type { BannerTagKey } from "@/lib/db/models/BannerSettings";

const GLOBAL_KEY = "global";

const TAG_KEYS = new Set<BannerTagKey>(["hot", "popular", "combo", "premium", "best"]);

function err(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function mergeAdminResponse(row: Record<string, unknown> | null) {
  const d = DEFAULT_BANNER_COPY;
  const stats =
    Array.isArray(row?.stats) && row.stats.length > 0
      ? (row.stats as { value: string; label: string }[]).map((s) => ({
          value: String(s.value ?? ""),
          label: String(s.label ?? ""),
        }))
      : [...d.stats];

  const carouselSlides = Array.isArray(row?.carouselSlides)
    ? (row.carouselSlides as { tag?: string; tagKey?: string; productId?: unknown }[]).map((s) => ({
        tag: String(s.tag ?? ""),
        tagKey: String(s.tagKey ?? ""),
        productId:
          s.productId instanceof mongoose.Types.ObjectId
            ? s.productId.toHexString()
            : String(s.productId ?? ""),
      }))
    : [];

  return {
    trustBadgeText: typeof row?.trustBadgeText === "string" ? row.trustBadgeText : d.trustBadgeText,
    headlinePart1: typeof row?.headlinePart1 === "string" ? row.headlinePart1 : d.headlinePart1,
    headlinePart2: typeof row?.headlinePart2 === "string" ? row.headlinePart2 : d.headlinePart2,
    tagline: typeof row?.tagline === "string" ? row.tagline : d.tagline,
    subtextHtml: typeof row?.subtextHtml === "string" ? row.subtextHtml : d.subtextHtml,
    stats,
    backgroundImageUrl:
      typeof row?.backgroundImageUrl === "string" ? row.backgroundImageUrl : d.backgroundImageUrl,
    carouselSlides,
  };
}

export async function GET() {
  try {
    await connectDb();
    const row = await BannerSettingsModel.findOne({ key: GLOBAL_KEY }).lean();
    return NextResponse.json({ data: mergeAdminResponse(row as Record<string, unknown> | null) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDb();
    const body = (await req.json()) as Record<string, unknown>;

    const trustBadgeText =
      typeof body.trustBadgeText === "string" ? body.trustBadgeText.trim() : DEFAULT_BANNER_COPY.trustBadgeText;
    const headlinePart1 =
      typeof body.headlinePart1 === "string" ? body.headlinePart1 : DEFAULT_BANNER_COPY.headlinePart1;
    const headlinePart2 =
      typeof body.headlinePart2 === "string" ? body.headlinePart2 : DEFAULT_BANNER_COPY.headlinePart2;
    const tagline = typeof body.tagline === "string" ? body.tagline : DEFAULT_BANNER_COPY.tagline;
    const subtextHtml =
      typeof body.subtextHtml === "string" ? body.subtextHtml : DEFAULT_BANNER_COPY.subtextHtml;
    const backgroundImageUrl =
      typeof body.backgroundImageUrl === "string"
        ? body.backgroundImageUrl.trim()
        : DEFAULT_BANNER_COPY.backgroundImageUrl;

    let stats: { value: string; label: string }[] = [];
    if (Array.isArray(body.stats)) {
      for (const s of body.stats) {
        if (!s || typeof s !== "object") continue;
        const o = s as { value?: unknown; label?: unknown };
        const value = String(o.value ?? "").trim();
        const label = String(o.label ?? "").trim();
        if (value && label) stats.push({ value, label });
      }
    }
    if (stats.length === 0) stats = [...DEFAULT_BANNER_COPY.stats];

    const carouselSlides: { tag: string; tagKey: BannerTagKey; productId: mongoose.Types.ObjectId }[] = [];
    if (Array.isArray(body.carouselSlides)) {
      for (const raw of body.carouselSlides) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as { tag?: unknown; tagKey?: unknown; productId?: unknown };
        const tag = String(o.tag ?? "").trim();
        const tagKey = String(o.tagKey ?? "").trim() as BannerTagKey;
        const pid = String(o.productId ?? "").trim();
        if (!tag || !pid || !mongoose.Types.ObjectId.isValid(pid)) continue;
        if (!TAG_KEYS.has(tagKey)) {
          return err(`Invalid tagKey: ${tagKey}`, 400);
        }
        carouselSlides.push({
          tag,
          tagKey,
          productId: new mongoose.Types.ObjectId(pid),
        });
      }
    }

    const row = await BannerSettingsModel.findOneAndUpdate(
      { key: GLOBAL_KEY },
      {
        $set: {
          trustBadgeText,
          headlinePart1,
          headlinePart2,
          tagline,
          subtextHtml,
          stats,
          backgroundImageUrl,
          carouselSlides,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ data: mergeAdminResponse(row as Record<string, unknown> | null) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
