/**
 * Upserts 2 storewide coupons (empty product/category lists = entire catalog).
 *
 * Usage (from project root):
 *   npm run seed:coupons
 * Or:
 *   node --env-file=.env.local scripts/seed-sample-coupons.cjs
 */

const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI. Use: npm run seed:coupons (loads .env.local)");
  process.exit(1);
}

const now = new Date();

const coupons = [
  {
    code: "RPT-VOLUME-PCT",
    name: "Volume discount — all products",
    description:
      "Stepped percentage off the couponable cart subtotal (GST-inclusive, non-combo lines only). " +
      "Discount unlocks by total eligible packet count across the cart — e.g. 7% from 15 packets, up to 12% from 85+ packets. " +
      "Bags and cartons count toward packets per your price list. Applies to every active product unless a narrower coupon is used.",
    discountType: "percentage",
    tierUnit: "packets",
    packetTiers: [
      { minPackets: 15, value: 7 },
      { minPackets: 30, value: 8 },
      { minPackets: 50, value: 9 },
      { minPackets: 85, value: 12 },
    ],
    applicableProductIds: [],
    applicableCategoryIds: [],
    isActive: true,
    updatedAt: now,
  },
  {
    code: "RPT-ORDER-FLAT",
    name: "Large order — flat ₹ off (all products)",
    description:
      "Flat INR off the eligible subtotal when packet thresholds are met (same packet rules as list pricing). " +
      "Designed for heavier single orders across the full catalogue. " +
      "Not combinable with other percentage coupons on the same lines; pick the offer that gives the lower net total.",
    discountType: "flat",
    tierUnit: "packets",
    packetTiers: [
      { minPackets: 25, value: 400 },
      { minPackets: 50, value: 900 },
      { minPackets: 100, value: 2000 },
    ],
    applicableProductIds: [],
    applicableCategoryIds: [],
    isActive: true,
    updatedAt: now,
  },
  {
    code: "RPT-OUTER-PCT",
    name: "Carton & bag volume — percentage (all products)",
    description:
      "Stepped percentage off the couponable subtotal when the cart reaches outer-unit thresholds: " +
      "each master bag counts as one unit; packet lines count as cartons (from pcs/carton) or as master-bag equivalents when qty/bag is known. " +
      "Mongo per-carton / per-bag priced lines use priced carton or bag counts.",
    discountType: "percentage",
    tierUnit: "outer",
    packetTiers: [
      { minPackets: 5, value: 5 },
      { minPackets: 10, value: 7 },
      { minPackets: 15, value: 9 },
      { minPackets: 25, value: 11 },
    ],
    applicableProductIds: [],
    applicableCategoryIds: [],
    isActive: true,
    updatedAt: now,
  },
  {
    code: "RPT-OUTER-FLAT",
    name: "Carton & bag volume — flat ₹ (all products)",
    description:
      "Flat INR off the eligible subtotal when total outer units (cartons + master bags on eligible lines) meet the thresholds. " +
      "Same outer counting rules as RPT-OUTER-PCT.",
    discountType: "flat",
    tierUnit: "outer",
    packetTiers: [
      { minPackets: 5, value: 250 },
      { minPackets: 12, value: 600 },
      { minPackets: 20, value: 1200 },
    ],
    applicableProductIds: [],
    applicableCategoryIds: [],
    isActive: true,
    updatedAt: now,
  },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.collection("coupons");

  for (const c of coupons) {
    const { updatedAt, ...rest } = c;
    const res = await col.updateOne(
      { code: rest.code },
      {
        $set: { ...rest, updatedAt },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    const action =
      res.upsertedCount > 0 ? "inserted" : res.modifiedCount > 0 ? "updated" : "unchanged";
    console.log(
      `${action}: ${rest.code} (${rest.discountType}, ${rest.tierUnit ?? "packets"}, ${rest.packetTiers.length} tiers)`
    );
  }

  console.log("Done. All seeded coupons apply to all products (no category/product restrictions).");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
