"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiProduct } from "@/app/lib/api/types";
import { apiProductToProduct } from "@/app/lib/api/mapApiProduct";
import { sortApiProductsForHomeOrder } from "@/app/lib/sortApiProductsDisplay";
import { getSellerOffers, type ProductListingEntry } from "@/app/data/products";
import ProductGrid from "../ShopSection/ProductGrid/ProductGrid";
import type { ComboRuleGuard } from "@/lib/combo/comboAddGuard";

type Props = {
  apiProducts: ApiProduct[];
};

export default function HomeProductsSortedGrid({ apiProducts }: Props) {
  const [comboTargetSlugs, setComboTargetSlugs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/combo/active-guard-rules", { cache: "no-store" });
        const json = (await res.json()) as { data?: { rules?: ComboRuleGuard[] } };
        if (cancelled || !res.ok || !Array.isArray(json.data?.rules)) return;
        const target = new Set<string>();
        for (const r of json.data.rules) {
          for (const s of r.targetSlugs ?? []) {
            const n = String(s).trim().toLowerCase();
            if (n) target.add(n);
          }
        }
        setComboTargetSlugs([...target]);
      } catch {
        if (!cancelled) setComboTargetSlugs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listingEntries = useMemo(() => {
    const sorted = sortApiProductsForHomeOrder(apiProducts);
    return sorted
      .map((apiProduct) => {
        const product = apiProductToProduct(apiProduct);
        const offer = getSellerOffers(product)[0];
        if (!offer) return null;
        const entry: ProductListingEntry = { product, offer };
        return entry;
      })
      .filter((entry): entry is ProductListingEntry => entry !== null);
  }, [apiProducts]);
  return (
    <ProductGrid
      listingEntries={listingEntries}
      cardListingLayout
      comboTriggerSlugs={comboTargetSlugs}
      showSizeInTitle={false}
    />
  );
}
