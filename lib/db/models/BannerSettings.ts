import mongoose, { Schema, models, model } from "mongoose";

const TAG_KEYS = ["hot", "popular", "combo", "premium", "best"] as const;

const statItemSchema = new Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const carouselSlideSchema = new Schema(
  {
    tag: { type: String, required: true, trim: true },
    tagKey: { type: String, required: true, enum: TAG_KEYS },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { _id: false }
);

const bannerSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    trustBadgeText: { type: String, trim: true },
    headlinePart1: { type: String, trim: true },
    headlinePart2: { type: String, trim: true },
    tagline: { type: String, trim: true },
    /** Admin-controlled HTML (e.g. <strong>…) for the hero paragraph */
    subtextHtml: { type: String, trim: true },
    stats: { type: [statItemSchema], default: [] },
    /** Public path or absolute URL — hero background */
    backgroundImageUrl: { type: String, trim: true },
    carouselSlides: { type: [carouselSlideSchema], default: [] },
  },
  { timestamps: true }
);

export type BannerTagKey = (typeof TAG_KEYS)[number];

export const BannerSettingsModel = models.BannerSettings ?? model("BannerSettings", bannerSettingsSchema);
