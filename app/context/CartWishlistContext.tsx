"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import styles from "./CartWishlistContext.module.css";
import {
  normalizeOrderMode,
  pricedPacketCount,
  type CartOrderMode,
} from "@/lib/cart/packetLine";
import { loadCartFromStorage, saveCartToStorage } from "@/lib/cart/cartStorage";
import { comboCartLineKeyFromCartItem } from "@/lib/cart/cartLineKey";
import {
  isEligibleForCombo,
  comboTargetAddBlockedInfo,
  comboQualifyingTriggersSectionHeading,
  comboTargetAlreadyInCartConflict,
  type ComboRuleGuard,
  type ComboTargetAddBlockedInfo,
} from "@/lib/combo/comboAddGuard";
import {
  comboTargetMaxReachedMessage,
  effectiveTargetCapForSlug,
  wouldExceedTargetCap,
} from "@/lib/combo/comboTargetCap";
import type { ThresholdUnit } from "@/lib/comboRules/thresholdUnits";

/** Must match `DEFAULT_SELLER_ID` in `app/data/products.ts` (not imported here to keep this client bundle lean). */
const DEFAULT_SELLER_ID = "default";

export interface CartItem {
  productId: number;
  /** MongoDB ObjectId string when the line came from the API catalog — used for coupon targeting */
  mongoProductId?: string;
  categoryMongoId?: string;
  productSlug: string;
  productImage: string;
  productName: string;
  brand: string;
  category: string;
  /** Distinguishes the same SKU from different sellers */
  sellerId: string;
  sellerName: string;
  size: string;
  /** Packet count when `orderMode` is `packets`; bag count when `orderMode` is `master_bag` */
  quantity: number;
  /** With GST, per packet (priced unit) */
  pricePerUnit: number;
  basicPricePerUnit: number;
  qtyPerBag: number;
  pcsPerPacket: number;
  /**
   * `packets`: `quantity` = number of packets (price × packets).
   * `master_bag`: `quantity` = number of master bags; line amount = price × (quantity × qtyPerBag) packets.
   */
  orderMode?: CartOrderMode;
  /** Optional: packets per shipping carton — used for carton-based combo caps (matches resolver when set). */
  packetsPerCarton?: number;
  /** Packets on this line priced at RPT combo net rate (set by combo pricing sync) */
  comboPricedPackets?: number;
  /** GST-inclusive value of combo net-priced packets (authoritative for coupon exclusion) */
  comboSubtotalInclGst?: number;
  /** True when any packets use combo net rate */
  isComboApplied?: boolean;
}

/** How to combine combo rates with coupons: combo lines stay net; coupon hits non-combo only, unless user forgoes combo. */
export type CartCouponPricingMode = "combo_first" | "list_for_full_coupon";

export type { CartOrderMode };

export type AddCartItemInput = Omit<CartItem, "quantity">;

function normalizeSellerId(sellerId: string | undefined): string {
  return sellerId && sellerId.length > 0 ? sellerId : DEFAULT_SELLER_ID;
}

function sameLine(
  ci: CartItem,
  productId: number,
  size: string,
  sellerId: string,
  orderMode: CartOrderMode
): boolean {
  return (
    ci.productId === productId &&
    ci.size === size &&
    ci.sellerId === normalizeSellerId(sellerId) &&
    normalizeOrderMode(ci.orderMode) === orderMode
  );
}

type CartAddOutcome =
  | { ok: true }
  | { ok: false; reason: "guard" }
  | {
      ok: false;
      reason: "target_conflict";
      existingTargetSlug: string;
      fallbackTargetSlugs: string[];
    }
  | { ok: false; reason: "cap"; cap: number; unit: ThresholdUnit };

/** Pure: whether add/merge would succeed under combo guard + target cap (mirrors addToCart). */
function getCartAddOutcome(
  prev: CartItem[],
  row: AddCartItemInput,
  sid: string,
  mode: CartOrderMode,
  qty: number,
  rules: ComboRuleGuard[] | null
): CartAddOutcome {
  const existing = prev.find((ci) => sameLine(ci, row.productId, row.size, row.sellerId, mode));
  if (!existing && rules && row.productSlug?.trim()) {
    const conflict = comboTargetAlreadyInCartConflict(row.productSlug, prev, rules);
    if (conflict) {
      return {
        ok: false,
        reason: "target_conflict",
        existingTargetSlug: conflict.existingTargetSlug,
        fallbackTargetSlugs: conflict.fallbackTargetSlugs,
      };
    }
    if (!isEligibleForCombo(row.productSlug, prev, rules)) {
      return { ok: false, reason: "guard" };
    }
  }
  if (rules?.length && row.productSlug?.trim()) {
    const proposed = {
      productSlug: row.productSlug,
      productId: row.productId,
      size: row.size,
      sellerId: sid,
      orderMode: mode,
      quantity: qty,
      qtyPerBag: row.qtyPerBag,
      pcsPerPacket: row.pcsPerPacket,
      packetsPerCarton: row.packetsPerCarton,
    };
    if (wouldExceedTargetCap(row.productSlug, prev, proposed, rules)) {
      const eff = effectiveTargetCapForSlug(row.productSlug, rules);
      if (eff) return { ok: false, reason: "cap", cap: eff.cap, unit: eff.unit };
      return { ok: false, reason: "guard" };
    }
  }
  return { ok: true };
}

interface CartWishlistState {
  cartItems: CartItem[];
  /** True after localStorage cart has been loaded on the client */
  cartHydrated: boolean;
  cartCount: number;
  cartTotal: number;
  cartBasicTotal: number;
  applyComboPricingLines: (
    updates: Array<{
      key: string;
      pricePerUnit: number;
      basicPricePerUnit: number;
      comboPricedPackets: number;
      comboSubtotalInclGst?: number;
      isComboApplied?: boolean;
    }>
  ) => void;
  /** When `list_for_full_coupon`, combo allocation is skipped so coupons can use list-priced totals */
  couponPricingMode: CartCouponPricingMode;
  setCouponPricingMode: (mode: CartCouponPricingMode) => void;
  /** Returns true if the line was added/updated; false if combo guard or target cap blocked it. */
  addToCart: (item: AddCartItemInput, qty?: number) => boolean;
  removeFromCart: (productId: number, size: string, sellerId?: string, orderMode?: CartOrderMode) => void;
  /** Remove every line for this product + size + seller (both packet and bulk rows) */
  removeCartGroup: (productId: number, size: string, sellerId?: string) => void;
  updateQuantity: (productId: number, size: string, qty: number, sellerId?: string, orderMode?: CartOrderMode) => void;
  updateSize: (
    productId: number,
    oldSize: string,
    newSize: string,
    newPrice: number,
    newBasicPrice: number,
    newQtyPerBag: number,
    newPcsPerPacket: number,
    sellerId?: string,
    orderMode?: CartOrderMode
  ) => void;
  clearCart: () => void;
  /** In-app notice when a combo target line is blocked (see combo add guard) */
  comboAddBlockedNotice: ComboTargetAddBlockedInfo | null;
  clearComboAddBlockedNotice: () => void;
  /** Max combo target cap reached (see comboTargetCap) */
  comboTargetCapNotice: string | null;
  clearComboTargetCapNotice: () => void;
  /** Active combo guard rules (null until first fetch completes) */
  comboGuardRules: ComboRuleGuard[] | null;
}

const CartWishlistContext = createContext<CartWishlistState | null>(null);

export function CartWishlistProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  /** False until client has read localStorage — avoids overwriting saved cart with [] on first paint */
  const [cartHydrated, setCartHydrated] = useState(false);
  const [couponPricingMode, setCouponPricingMode] = useState<CartCouponPricingMode>("combo_first");
  const [comboGuardRules, setComboGuardRules] = useState<ComboRuleGuard[] | null>(null);
  const [comboAddBlockedNotice, setComboAddBlockedNotice] = useState<ComboTargetAddBlockedInfo | null>(null);
  const [comboTargetCapNotice, setComboTargetCapNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/combo/active-guard-rules", { cache: "no-store" });
        const json = (await res.json()) as { data?: { rules?: ComboRuleGuard[] } };
        if (cancelled) return;
        if (res.ok && Array.isArray(json.data?.rules)) {
          setComboGuardRules(json.data!.rules!);
        } else {
          setComboGuardRules([]);
        }
      } catch {
        if (!cancelled) setComboGuardRules([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    /* Persisted cart only exists in the browser — load after mount to match SSR (empty) then fill */
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setCartItems(loadCartFromStorage());
    setCartHydrated(true);
  }, []);

  useEffect(() => {
    if (!comboAddBlockedNotice) return;
    const t = window.setTimeout(() => setComboAddBlockedNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [comboAddBlockedNotice]);

  useEffect(() => {
    if (!comboTargetCapNotice) return;
    const t = window.setTimeout(() => setComboTargetCapNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [comboTargetCapNotice]);

  useEffect(() => {
    if (!cartHydrated) return;
    saveCartToStorage(cartItems);
  }, [cartItems, cartHydrated]);

  const clearComboAddBlockedNotice = useCallback(() => setComboAddBlockedNotice(null), []);
  const clearComboTargetCapNotice = useCallback(() => setComboTargetCapNotice(null), []);

  const addToCart = useCallback(
    (item: AddCartItemInput, qty: number = 1): boolean => {
      const sid = normalizeSellerId(item.sellerId);
      const mode = normalizeOrderMode(item.orderMode);
      const row: AddCartItemInput = { ...item, sellerId: sid, orderMode: mode };
      let added = false;
      setCartItems((prev) => {
        const outcome = getCartAddOutcome(prev, row, sid, mode, qty, comboGuardRules);
        if (!outcome.ok) {
          if (outcome.reason === "guard") {
            setComboTargetCapNotice(null);
            setComboAddBlockedNotice(comboTargetAddBlockedInfo(row.productSlug, comboGuardRules));
          } else if (outcome.reason === "target_conflict") {
            const existingTargetLine = prev.find(
              (ci) => String(ci.productSlug || "").trim().toLowerCase() === outcome.existingTargetSlug
            );
            const requestedName = String(
              row.productName ||
                row.productSlug
                  .split("-")
                  .filter(Boolean)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ") ||
                "YEH COMBO PRODUCT"
            ).toUpperCase();
            const existingName = String(
              existingTargetLine?.productName ||
                outcome.existingTargetSlug
                  .split("-")
                  .filter(Boolean)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ") ||
                outcome.existingTargetSlug
            ).toUpperCase();
            setComboTargetCapNotice(null);
            setComboAddBlockedNotice({
              message: `⚠️ ${existingName} pehle se aapki cart me hai, isliye ${requestedName || "YEH COMBO PRODUCT"} abhi add nahi ho sakta. Combo rule ke hisaab se ek time par ek hi combo target allow hai. Neeche diye gaye non-combo products add karke order continue karein.`,
              qualifyingProductSlugs: outcome.fallbackTargetSlugs,
              linksHeading: "Abhi regular rate par add kar sakte ho:",
            });
          } else {
            setComboAddBlockedNotice(null);
            setComboTargetCapNotice(comboTargetMaxReachedMessage(outcome.cap, outcome.unit));
          }
          added = false;
          return prev;
        }
        added = true;
        const existing = prev.find((ci) => sameLine(ci, row.productId, row.size, row.sellerId, mode));
        if (existing) {
          return prev.map((ci) =>
            sameLine(ci, row.productId, row.size, row.sellerId, mode) ? { ...ci, quantity: qty } : ci
          );
        }
        return [...prev, { ...row, quantity: qty }];
      });
      return added;
    },
    [comboGuardRules]
  );

  const removeFromCart = useCallback((productId: number, size: string, sellerId?: string, orderMode?: CartOrderMode) => {
    const sid = normalizeSellerId(sellerId);
    const mode = normalizeOrderMode(orderMode);
    setCartItems((prev) => prev.filter((ci) => !sameLine(ci, productId, size, sid, mode)));
  }, []);

  const removeCartGroup = useCallback((productId: number, size: string, sellerId?: string) => {
    const sid = normalizeSellerId(sellerId);
    setCartItems((prev) =>
      prev.filter((ci) => !(ci.productId === productId && ci.size === size && ci.sellerId === sid))
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: number, size: string, qty: number, sellerId?: string, orderMode?: CartOrderMode) => {
      if (qty < 1) return;
      const sid = normalizeSellerId(sellerId);
      const mode = normalizeOrderMode(orderMode);
      setCartItems((prev) => {
        const ci = prev.find((c) => sameLine(c, productId, size, sid, mode));
        if (!ci) return prev;
        if (comboGuardRules?.length && ci.productSlug?.trim()) {
          const proposed = {
            productSlug: ci.productSlug,
            productId: ci.productId,
            size: ci.size,
            sellerId: sid,
            orderMode: mode,
            quantity: qty,
            qtyPerBag: ci.qtyPerBag,
            pcsPerPacket: ci.pcsPerPacket,
            packetsPerCarton: ci.packetsPerCarton,
          };
          if (wouldExceedTargetCap(ci.productSlug, prev, proposed, comboGuardRules)) {
            const eff = effectiveTargetCapForSlug(ci.productSlug, comboGuardRules);
            if (eff) {
              window.setTimeout(() => setComboTargetCapNotice(comboTargetMaxReachedMessage(eff.cap, eff.unit)), 0);
            }
            return prev;
          }
        }
        return prev.map((c) => (sameLine(c, productId, size, sid, mode) ? { ...c, quantity: qty } : c));
      });
    },
    [comboGuardRules]
  );

  const updateSize = useCallback((
    productId: number,
    oldSize: string,
    newSize: string,
    newPrice: number,
    newBasicPrice: number,
    newQtyPerBag: number,
    newPcsPerPacket: number,
    sellerId?: string,
    orderMode?: CartOrderMode,
  ) => {
    const sid = normalizeSellerId(sellerId);
    const mode = normalizeOrderMode(orderMode);
    setCartItems((prev) =>
      prev.map((ci) =>
        sameLine(ci, productId, oldSize, sid, mode)
          ? {
              ...ci,
              size: newSize,
              pricePerUnit: newPrice,
              basicPricePerUnit: newBasicPrice,
              qtyPerBag: newQtyPerBag,
              pcsPerPacket: newPcsPerPacket,
            }
          : ci
      )
    );
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const applyComboPricingLines = useCallback(
    (
      updates: Array<{
        key: string;
        pricePerUnit: number;
        basicPricePerUnit: number;
        comboPricedPackets: number;
        comboSubtotalInclGst?: number;
        isComboApplied?: boolean;
      }>
    ) => {
      const map = new Map(updates.map((u) => [u.key, u]));
      setCartItems((prev) => {
        let changed = false;
        const next = prev.map((ci) => {
          const hit = map.get(comboCartLineKeyFromCartItem(ci));
          if (!hit) return ci;
          const nextComboGst = hit.comboSubtotalInclGst;
          const nextIsCombo =
            (hit.comboPricedPackets ?? 0) > 0 ||
            (hit.comboSubtotalInclGst ?? 0) > 0.005 ||
            Boolean(hit.isComboApplied);
          const priceSame = Math.abs((ci.pricePerUnit ?? 0) - hit.pricePerUnit) < 0.005;
          const basicSame = Math.abs((ci.basicPricePerUnit ?? 0) - hit.basicPricePerUnit) < 0.005;
          if (
            priceSame &&
            basicSame &&
            (ci.comboPricedPackets ?? 0) === hit.comboPricedPackets &&
            Math.abs((ci.comboSubtotalInclGst ?? 0) - (nextComboGst ?? 0)) < 0.005 &&
            Boolean(ci.isComboApplied) === nextIsCombo
          ) {
            return ci;
          }
          changed = true;
          return {
            ...ci,
            pricePerUnit: hit.pricePerUnit,
            basicPricePerUnit: hit.basicPricePerUnit,
            comboPricedPackets: hit.comboPricedPackets,
            comboSubtotalInclGst: nextComboGst,
            isComboApplied: nextIsCombo,
          };
        });
        return changed ? next : prev;
      });
    },
    []
  );

  const cartCount = useMemo(
    () => cartItems.length,
    [cartItems]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, ci) => sum + ci.pricePerUnit * pricedPacketCount(ci),
        0
      ),
    [cartItems]
  );

  const cartBasicTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, ci) => sum + ci.basicPricePerUnit * pricedPacketCount(ci),
        0
      ),
    [cartItems]
  );

  return (
    <>
      <CartWishlistContext.Provider
        value={{
          cartItems,
          cartHydrated,
          cartCount,
          cartTotal,
          cartBasicTotal,
          applyComboPricingLines,
          couponPricingMode,
          setCouponPricingMode,
          addToCart,
          removeFromCart,
          removeCartGroup,
          updateQuantity,
          updateSize,
          clearCart,
          comboAddBlockedNotice,
          clearComboAddBlockedNotice,
          comboTargetCapNotice,
          clearComboTargetCapNotice,
          comboGuardRules,
        }}
      >
        {children}
      </CartWishlistContext.Provider>
      {comboTargetCapNotice || comboAddBlockedNotice ? (
        <div
          role="alert"
          className={styles.noticeShell}
          style={{
            backgroundColor: comboTargetCapNotice ? "#fef2f2" : "#fffbeb",
            borderColor: comboTargetCapNotice ? "#fecaca" : "#fcd34d",
            color: comboTargetCapNotice ? "#7f1d1d" : "#78350f",
          }}
        >
          <div className={styles.noticeContent}>
            {comboTargetCapNotice ? (
              <span>{comboTargetCapNotice}</span>
            ) : comboAddBlockedNotice ? (
              <>
                <div>{comboAddBlockedNotice.message}</div>
                {comboAddBlockedNotice.qualifyingProductSlugs.length > 0 ? (
                  <div className={styles.noticeLinksBlock}>
                    <div className={styles.noticeLinksHeading}>
                      {comboAddBlockedNotice.linksHeading ??
                        comboQualifyingTriggersSectionHeading(comboAddBlockedNotice.qualifyingProductSlugs.length)}
                    </div>
                    <div className={styles.noticeLinksWrap}>
                      {comboAddBlockedNotice.qualifyingProductSlugs.slice(0, 12).map((slug) => (
                        <Link
                          key={slug}
                          href={`/products/${encodeURIComponent(slug)}`}
                          prefetch={false}
                          onClick={() => {
                            clearComboAddBlockedNotice();
                            clearComboTargetCapNotice();
                          }}
                          className={styles.noticeLink}
                        >
                          {slug
                            .split("-")
                            .filter(Boolean)
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                            .join(" ") || slug}
                        </Link>
                      ))}
                    </div>
                    {!comboAddBlockedNotice.linksHeading &&
                    comboAddBlockedNotice.qualifyingProductSlugs.length > 12 ? (
                      <div className={styles.noticeExtraText}>
                        +{comboAddBlockedNotice.qualifyingProductSlugs.length - 12} aur qualifying{" "}
                        {comboAddBlockedNotice.qualifyingProductSlugs.length - 12 === 1 ? "product" : "products"} is
                        offer mein — search ya category browse karke add kar sakte ho.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              clearComboTargetCapNotice();
              clearComboAddBlockedNotice();
            }}
            className={styles.noticeCloseBtn}
            style={{
              color: comboTargetCapNotice ? "#991b1b" : "#92400e",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}

export function useCartWishlist() {
  const ctx = useContext(CartWishlistContext);
  if (!ctx) throw new Error("useCartWishlist must be used within CartWishlistProvider");
  return ctx;
}

export {
  isEligibleForCombo,
  COMBO_TARGET_ADD_BLOCKED_MESSAGE,
  messageForComboTargetAddBlocked,
  comboTargetAddBlockedInfo,
} from "@/lib/combo/comboAddGuard";
export type { ComboRuleGuard, ComboTargetAddBlockedInfo } from "@/lib/combo/comboAddGuard";
