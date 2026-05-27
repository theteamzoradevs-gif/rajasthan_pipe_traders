import mongoose from "mongoose";
import type { ParsedBulkPriceUpdate } from "@/lib/products/bulkPriceExcel";

/**
 * Storefront listing/PDP read `sizes[]` / `sellers[].sizes` when present — not only `pricing`.
 * Pipeline update keeps nested size rows in sync with bulk-uploaded prices.
 */
export function buildBulkPriceBulkWriteOp(update: ParsedBulkPriceUpdate) {
  const { productId, basicPrice, priceWithGst } = update;
  const effectiveDate = new Date();

  return {
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(productId) },
      update: [
        {
          $set: {
            "pricing.basicPrice": basicPrice,
            "pricing.priceWithGst": priceWithGst,
            "pricing.priceListEffectiveDate": effectiveDate,
            sizes: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ["$sizes", []] } }, 0] },
                then: {
                  $map: {
                    input: "$sizes",
                    as: "sz",
                    in: {
                      $mergeObjects: [
                        "$$sz",
                        { basicPrice, priceWithGst },
                      ],
                    },
                  },
                },
                else: "$sizes",
              },
            },
            sellers: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ["$sellers", []] } }, 0] },
                then: {
                  $map: {
                    input: "$sellers",
                    as: "seller",
                    in: {
                      $mergeObjects: [
                        "$$seller",
                        {
                          sizes: {
                            $cond: {
                              if: {
                                $gt: [{ $size: { $ifNull: ["$$seller.sizes", []] } }, 0],
                              },
                              then: {
                                $map: {
                                  input: "$$seller.sizes",
                                  as: "sz",
                                  in: {
                                    $mergeObjects: [
                                      "$$sz",
                                      { basicPrice, priceWithGst },
                                    ],
                                  },
                                },
                              },
                              else: "$$seller.sizes",
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                else: "$sellers",
              },
            },
          },
        },
      ],
    },
  };
}
