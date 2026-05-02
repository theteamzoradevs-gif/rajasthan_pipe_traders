"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import {
  comboTargetSlugsForTrigger,
  isComboTriggerConditionMet,
  type CartLineForComboTriggerThreshold,
} from "@/lib/combo/comboAddGuard";
import styles from "./ProductDetail.module.css";

type Props = {
  productSlug: string;
  message: string;
  fallbackTargetSlugs?: string[];
  targetNameBySlug?: Record<string, string>;
};

function titleFromSlug(slug: string): string {
  const words = slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.toUpperCase());
  const raw = words.join(" ") || slug.toUpperCase();
  // Hide inline size labels like "25 MM" from combo chip names.
  return raw.replace(/\b\d+(?:\.\d+)?\s*MM\b/g, "").replace(/\s{2,}/g, " ").trim();
}

export default function ComboTriggerPdpHint({
  productSlug,
  message,
  fallbackTargetSlugs = [],
  targetNameBySlug,
}: Props) {
  const { cartItems, cartHydrated, comboGuardRules } = useCartWishlist();

  const cartLines = useMemo<CartLineForComboTriggerThreshold[]>(
    () =>
      cartItems.map((ci) => ({
        productSlug: ci.productSlug,
        quantity: ci.quantity,
        orderMode: ci.orderMode,
        qtyPerBag: ci.qtyPerBag,
        pcsPerPacket: ci.pcsPerPacket,
        packetsPerCarton: ci.packetsPerCarton,
      })),
    [cartItems]
  );

  const ruleTargetSlugs = useMemo(
    () => comboTargetSlugsForTrigger(productSlug, comboGuardRules),
    [productSlug, comboGuardRules]
  );
  const targetSlugs = ruleTargetSlugs.length > 0 ? ruleTargetSlugs : fallbackTargetSlugs;

  const conditionMet =
    cartHydrated &&
    comboGuardRules != null &&
    isComboTriggerConditionMet(productSlug, cartLines, comboGuardRules);

  const currentMessage = conditionMet
    ? "💥 Ab Milega Combo Offer! Aap ready ho — ab yeh product saste mein le sakte ho. You can buy this product now. Aap qualifying condition meet kar chuke ho, isliye combo offer apply ho sakta hai. 👉 Offer ka fayda uthayein."
    : message;

  if (conditionMet && targetSlugs.length === 0) return null;

  return (
    <div className={styles.comboTriggerPdpHint} role="status" aria-live="polite">
      <span className={styles.comboTriggerPdpHintBadge}>Combo Offer</span>
      <p className={styles.comboTriggerPdpHintText}>{currentMessage}</p>
      {targetSlugs.length > 0 ? (
        <div className={styles.comboTriggerPdpLinksWrap}>
          <span className={styles.comboTriggerPdpLinksLabel}>Combo products:</span>
          <div className={styles.comboTriggerPdpLinks}>
            {targetSlugs.slice(0, 10).map((slug) => (
              <Link
                key={slug}
                href={`/products/${encodeURIComponent(slug)}`}
                className={styles.comboTriggerPdpLink}
              >
                {targetNameBySlug?.[slug] || titleFromSlug(slug)}              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
