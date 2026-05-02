import { cache } from "react";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db/connect";
import { BannerSettingsModel } from "@/lib/db/models/BannerSettings";
import { ProductModel } from "@/lib/db/models/Product";
import { serializeProductLean } from "@/lib/db/serialize";
import type { ApiProduct } from "@/app/lib/api/types";
import { buildHeroSlideFromApiProduct, type HeroSlide } from "./heroSlide";
import { DEFAULT_BANNER_COPY } from "./defaults";

const GLOBAL_KEY = "global";

export type HomeBannerPayload = {
  trustBadgeText: string;
  headlinePart1: string;
  headlinePart2: string;
  tagline: string;
  subtextHtml: string;
  stats: { value: string; label: string }[];
  backgroundImageUrl: string;
  slides: HeroSlide[];
};

type LeanBanner = {
  trustBadgeText?: string;
  headlinePart1?: string;
  headlinePart2?: string;
  tagline?: string;
  subtextHtml?: string;
  stats?: { value?: string; label?: string }[];
  backgroundImageUrl?: string;
  carouselSlides?: { tag?: string; tagKey?: string; productId?: mongoose.Types.ObjectId }[];
};

function mergeCopy(row: LeanBanner | null): Omit<HomeBannerPayload, "slides"> {
  const d = DEFAULT_BANNER_COPY;
  const statsRaw = row?.stats?.length ? row.stats : d.stats;
  const stats = statsRaw
    .map((s) => ({
      value: String(s?.value ?? "").trim(),
      label: String(s?.label ?? "").trim(),
    }))
    .filter((s) => s.value && s.label);
  return {
    trustBadgeText: (row?.trustBadgeText ?? d.trustBadgeText).trim() || d.trustBadgeText,
    headlinePart1: (row?.headlinePart1 ?? d.headlinePart1).trim() || d.headlinePart1,
    /** Admin values are trimmed; default copy is used verbatim when the field is unset (see `DEFAULT_BANNER_COPY`). */
    headlinePart2:
      row?.headlinePart2 != null && String(row.headlinePart2).trim() !== ""
        ? String(row.headlinePart2).trim()
        : d.headlinePart2,
    tagline: (row?.tagline ?? d.tagline).trim() || d.tagline,
    subtextHtml: (row?.subtextHtml ?? d.subtextHtml).trim() || d.subtextHtml,
    stats: stats.length ? stats : [...d.stats],
    backgroundImageUrl: (row?.backgroundImageUrl ?? d.backgroundImageUrl).trim() || d.backgroundImageUrl,
  };
}

async function resolveSlides(row: LeanBanner | null): Promise<HeroSlide[]> {
  const slides: HeroSlide[] = [];
  const list = row?.carouselSlides;
  if (!list?.length) return slides;

  for (const item of list) {
    const pid = item?.productId;
    const tag = typeof item?.tag === "string" ? item.tag.trim() : "";
    const tagKey = typeof item?.tagKey === "string" ? item.tagKey.trim() : "";
    if (!pid || !tag || !tagKey) continue;

    const p = await ProductModel.findById(pid).populate("category", "name slug").lean();
    if (!p || (p as { isActive?: boolean }).isActive === false) continue;
    const ser = serializeProductLean(p as never);
    if (!ser) continue;
    const slide = buildHeroSlideFromApiProduct(ser as unknown as ApiProduct, { tag, tagKey });
    if (slide) slides.push(slide);
  }
  return slides;
}

export const getHomeBanner = cache(async (): Promise<HomeBannerPayload> => {
  await connectDb();
  const row = (await BannerSettingsModel.findOne({ key: GLOBAL_KEY }).lean()) as LeanBanner | null;
  const copy = mergeCopy(row);
  const slides = await resolveSlides(row);
  return { ...copy, slides };
});
