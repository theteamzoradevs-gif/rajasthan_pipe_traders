"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CartItem } from "@/app/context/CartWishlistContext";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import { normalizeOrderMode } from "@/lib/cart/packetLine";

type ComboApiLine = {
  key: string;
  pricePerUnit: number;
  basicPricePerUnit: number;
  comboPricedPackets: number;
  isComboApplied?: boolean;
  comboSubtotalInclGst?: number;
};

type ComboEligibleTarget = { slug: string; name: string };

type ComboPricingResponse = {
  data?: {
    lines: ComboApiLine[];
    smartSuggestion: string | null;
    comboEligibleTargets?: ComboEligibleTarget[];
    comboFallbackTargets?: ComboEligibleTarget[];
    comboSwapTargetSlugs?: string[];
    comboRemoveWhenNoTriggerSlugs?: string[];
    minimumOrderInclGst: number;
    minimumOrderMet: boolean;
    comboSavingsInclGst?: number;
  };
};

function linesPayload(items: CartItem[]) {
  return items.map((ci) => ({
    mongoProductId: ci.mongoProductId,
    productId: ci.productId,
    productSlug: ci.productSlug,
    size: ci.size,
    sellerId: ci.sellerId,
    orderMode: normalizeOrderMode(ci.orderMode),
    quantity: ci.quantity,
    qtyPerBag: ci.qtyPerBag,
    pcsPerPacket: ci.pcsPerPacket,
    pricePerUnit: ci.pricePerUnit,
    basicPricePerUnit: ci.basicPricePerUnit,
  }));
}

export default function ComboCartPricingSync({
  onMeta,
}: {
  onMeta: (meta: {
    suggestion: string | null;
    comboEligibleTargets: ComboEligibleTarget[];
    comboFallbackTargets: ComboEligibleTarget[];
    comboSwapTargetSlugs: string[];
    comboRemoveWhenNoTriggerSlugs: string[];
    minimumOrderInclGst: number;
    minimumOrderMet: boolean;
    comboSavingsInclGst: number;
  }) => void;
}) {
  const { cartItems, cartHydrated, applyComboPricingLines, couponPricingMode } = useCartWishlist();
  const reqId = useRef(0);
  const onMetaRef = useRef(onMeta);
  const applyComboRef = useRef(applyComboPricingLines);
  onMetaRef.current = onMeta;
  applyComboRef.current = applyComboPricingLines;

  /** Stable key so quantity/order changes always refetch — avoids stale closures on cart identity. */
  const cartPricingSyncKey = useMemo(
    () =>
      cartItems
        .map(
          (ci) =>
            `${ci.mongoProductId ?? ci.productId}|${ci.size}|${ci.sellerId}|${normalizeOrderMode(ci.orderMode)}|${ci.quantity}`
        )
        .join("§"),
    [cartItems]
  );

  useEffect(() => {
    if (!cartHydrated || cartItems.length === 0) {
      onMetaRef.current({
        suggestion: null,
        comboEligibleTargets: [],
        comboFallbackTargets: [],
        minimumOrderInclGst: 25_000,
        minimumOrderMet: true,
        comboSavingsInclGst: 0,
        comboSwapTargetSlugs: [],
        comboRemoveWhenNoTriggerSlugs: [],
      });
      return;
    }

    const id = ++reqId.current;
    const ac = new AbortController();

    void (async () => {
      try {
        const preferListOverCombo = couponPricingMode === "list_for_full_coupon";
        const res = await fetch("/api/cart/combo-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: linesPayload(cartItems),
            preferListOverCombo,
          }),
          signal: ac.signal,
        });
        const json = (await res.json()) as ComboPricingResponse;
        if (id !== reqId.current) return;

        if (!res.ok || !json.data) {
          return;
        }

        const data = json.data;
        if (Array.isArray(data.lines)) {
          applyComboRef.current(
            data.lines.map((row) => {
              const comboPk = row.comboPricedPackets ?? 0;
              const comboGst = row.comboSubtotalInclGst ?? 0;
              /** Prefer packet count / GST slice over `isComboApplied` — `??` would keep literal `false` and skip fallback. */
              const isComboApplied =
                Boolean(row.isComboApplied) || comboPk > 0 || comboGst > 0.005;
              return {
                key: row.key,
                pricePerUnit: row.pricePerUnit,
                basicPricePerUnit: row.basicPricePerUnit,
                comboPricedPackets: comboPk,
                comboSubtotalInclGst: row.comboSubtotalInclGst,
                isComboApplied,
              };
            })
          );
        }

        const rawTargets = Array.isArray(data.comboEligibleTargets) ? data.comboEligibleTargets : [];
        const comboEligibleTargets = rawTargets
          .map((t) => {
            const slug = typeof t.slug === "string" ? t.slug.trim().toLowerCase() : "";
            const nameRaw = typeof t.name === "string" ? t.name.trim() : "";
            return { slug, name: nameRaw || slug };
          })
          .filter((t) => t.slug.length > 0);

        const rawFallback = Array.isArray(data.comboFallbackTargets) ? data.comboFallbackTargets : [];
        const comboFallbackTargets = rawFallback
          .map((t) => {
            const slug = typeof t.slug === "string" ? t.slug.trim().toLowerCase() : "";
            const nameRaw = typeof t.name === "string" ? t.name.trim() : "";
            return { slug, name: nameRaw || slug };
          })
          .filter((t) => t.slug.length > 0);
        const comboSwapTargetSlugs = Array.isArray(data.comboSwapTargetSlugs)
          ? data.comboSwapTargetSlugs
              .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
              .filter((s) => s.length > 0)
          : [];
        const comboRemoveWhenNoTriggerSlugs = Array.isArray(data.comboRemoveWhenNoTriggerSlugs)
          ? data.comboRemoveWhenNoTriggerSlugs
              .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
              .filter((s) => s.length > 0)
          : [];

        onMetaRef.current({
          suggestion:
            typeof data.smartSuggestion === "string" && data.smartSuggestion.trim() !== ""
              ? data.smartSuggestion.trim()
              : null,
          comboEligibleTargets,
          comboFallbackTargets,
          comboSwapTargetSlugs,
          comboRemoveWhenNoTriggerSlugs,
          minimumOrderInclGst: data.minimumOrderInclGst ?? 25_000,
          minimumOrderMet: Boolean(data.minimumOrderMet),
          comboSavingsInclGst: data.comboSavingsInclGst ?? 0,
        });
      } catch {
        if (ac.signal.aborted) return;
      }
    })();

    return () => ac.abort();
  }, [cartPricingSyncKey, cartHydrated, couponPricingMode]);

  return null;
}
