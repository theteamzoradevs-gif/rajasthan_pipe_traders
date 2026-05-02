"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './CartPage.module.css';
import CartItemCard from './CartItemCard/CartItemCard';
import OrderSummary from './OrderSummary/OrderSummary';
import ComboCartPricingSync from './ComboCartPricingSync';
import OrderSuccessPopup from './OrderSuccessPopup/OrderSuccessPopup';
import QuotationDetailsModal, {
  type QuotationFormValues,
} from './QuotationDetailsModal/QuotationDetailsModal';
import { useCartWishlist } from '../../context/CartWishlistContext';
import {
  cartLinesForCouponApi,
  mapPublicCouponToOption,
  type CartCouponOption,
  type CouponApplyResult,
  type CouponValidateResponseJson,
  type ProductPackagingForCoupon,
  type PublicCouponBannerJson,
} from './cartCoupons';
import { groupCartItemsByProductLine, cartGroupKey } from '@/lib/cart/groupCartLines';
import { normalizeOrderMode } from '@/lib/cart/packetLine';
import { apiProductToProduct } from '@/app/lib/api/mapApiProduct';
import type { ApiProductsListResponse } from '@/app/lib/api/types';
import type { QuotationPdfOrderData } from '@/lib/utils/generateQuotationPDF';

export default function CartPage() {
  const router = useRouter();
  const {
    cartItems,
    cartCount,
    cartTotal,
    cartBasicTotal,
    removeFromCart,
    removeCartGroup,
    updateQuantity,
    addToCart,
    clearCart,
    couponPricingMode,
    setCouponPricingMode,
  } = useCartWishlist();

  const [successOpen, setSuccessOpen] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [orderedItems, setOrderedItems] = useState(cartItems);
  const [orderedTotal, setOrderedTotal] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [cartCoupons, setCartCoupons] = useState<CartCouponOption[]>([]);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [couponRevalidateError, setCouponRevalidateError] = useState<string | null>(null);
  const [userOptedOutCoupon, setUserOptedOutCoupon] = useState(false);
  const [autoCouponBusy, setAutoCouponBusy] = useState(false);
  /** Per cart line: Mongo packaging context for coupon tier math (carton/box/bag → packets). */
  const [couponPackagingByLine, setCouponPackagingByLine] = useState<
    (ProductPackagingForCoupon | null)[] | null
  >(null);
  const [comboMeta, setComboMeta] = useState({
    suggestion: null as string | null,
    comboEligibleTargets: [] as { slug: string; name: string }[],
    comboFallbackTargets: [] as { slug: string; name: string }[],
    comboSwapTargetSlugs: [] as string[],
    comboRemoveWhenNoTriggerSlugs: [] as string[],
    minimumOrderInclGst: 25_000,
    minimumOrderMet: true,
    comboSavingsInclGst: 0,
  });

  const cartSlugSet = useMemo(() => {
    const s = new Set<string>();
    for (const ci of cartItems) {
      const slug = typeof ci.productSlug === "string" ? ci.productSlug.trim().toLowerCase() : "";
      if (slug) s.add(slug);
    }
    return s;
  }, [cartItems]);

  const visibleEligibleTargets = useMemo(
    () => comboMeta.comboEligibleTargets.filter((t) => !cartSlugSet.has(t.slug)),
    [comboMeta.comboEligibleTargets, cartSlugSet]
  );
  const visibleFallbackTargets = useMemo(
    () => comboMeta.comboFallbackTargets.filter((t) => !cartSlugSet.has(t.slug)),
    [comboMeta.comboFallbackTargets, cartSlugSet]
  );
  const comboOfferClaimed = comboMeta.comboSavingsInclGst > 0;
  const comboConditionMet = visibleEligibleTargets.length > 0 || comboOfferClaimed;

  const gstTotal = cartTotal - cartBasicTotal;

  const roundMoney = (n: number) => Math.round(n * 100) / 100;
  const comboSavingsRow =
    comboMeta.comboSavingsInclGst > 0 && couponPricingMode === "combo_first"
      ? comboMeta.comboSavingsInclGst
      : 0;
  const cartMerchandiseBeforeVolume =
    comboSavingsRow > 0 ? roundMoney(cartTotal + comboSavingsRow) : cartTotal;
  const finalTotal = Math.max(
    0,
    roundMoney(cartMerchandiseBeforeVolume - comboSavingsRow - couponDiscount)
  );

  const cartGroups = useMemo(() => groupCartItemsByProductLine(cartItems), [cartItems]);

  const cartSignature = useMemo(
    () =>
      cartItems
        .map(
          (ci) =>
            `${ci.productId}:${ci.size}:${ci.sellerId}:${ci.quantity}:${ci.orderMode ?? "packets"}`
        )
        .join("|"),
    [cartItems]
  );

  const fallbackPayloadCacheRef = useRef(new Map<string, Parameters<typeof addToCart>[0] | null>());
  const swapBusyRef = useRef(false);

  const resolveAddPayloadForSlug = useCallback(async (slug: string, preferredSize?: string) => {
    const k = slug.trim().toLowerCase();
    if (!k) return null;
    const cacheKey = preferredSize ? `${k}|${preferredSize}` : k;
    if (fallbackPayloadCacheRef.current.has(cacheKey)) {
      return fallbackPayloadCacheRef.current.get(cacheKey) ?? null;
    }
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(k)}&limit=20`, { cache: "no-store" });
      const json = (await res.json()) as ApiProductsListResponse;
      if (!res.ok || !Array.isArray(json.data)) {
        fallbackPayloadCacheRef.current.set(cacheKey, null);
        return null;
      }
      const hit = json.data.find((p) => {
        const s = typeof p.slug === "string" ? p.slug.trim().toLowerCase() : "";
        return s === k;
      });
      if (!hit) {
        fallbackPayloadCacheRef.current.set(cacheKey, null);
        return null;
      }
      const mapped = apiProductToProduct(hit);
      const offer = mapped.sellers?.[0] ?? null;
      
      let size = offer?.sizes?.[0] ?? mapped.sizes?.[0];
      if (preferredSize) {
        const match = (offer?.sizes ?? mapped.sizes ?? []).find(s => s.size === preferredSize);
        if (match) size = match;
      }

      if (!size) {
        fallbackPayloadCacheRef.current.set(cacheKey, null);
        return null;
      }
      const payload: Parameters<typeof addToCart>[0] = {
        productId: mapped.id,
        mongoProductId: mapped.mongoProductId,
        categoryMongoId: mapped.categoryMongoId,
        productSlug: mapped.slug,
        productImage: mapped.image,
        productName: mapped.name,
        brand: offer?.brand ?? mapped.brand,
        category: mapped.category,
        sellerId: offer?.sellerId ?? "default",
        sellerName: offer?.sellerName ?? (mapped.brand || "Default"),
        size: size.size,
        pricePerUnit: size.withGST,
        basicPricePerUnit: size.basicPrice,
        qtyPerBag: size.qtyPerBag,
        pcsPerPacket: size.pcsPerPacket,
        orderMode: "packets",
      };
      fallbackPayloadCacheRef.current.set(cacheKey, payload);
      return payload;
    } catch {
      fallbackPayloadCacheRef.current.set(cacheKey, null);
      return null;
    }
  }, [addToCart]);

  useEffect(() => {
    if (comboMeta.comboRemoveWhenNoTriggerSlugs.length === 0) return;
    const kill = new Set(comboMeta.comboRemoveWhenNoTriggerSlugs);
    const matches = cartItems.filter((ci) => {
      const s = typeof ci.productSlug === "string" ? ci.productSlug.trim().toLowerCase() : "";
      return s.length > 0 && kill.has(s);
    });
    if (matches.length === 0) return;
    for (const row of matches) {
      removeFromCart(row.productId, row.size, row.sellerId, normalizeOrderMode(row.orderMode));
    }
  }, [cartItems, comboMeta.comboRemoveWhenNoTriggerSlugs, removeFromCart]);

  useEffect(() => {
    if (swapBusyRef.current) return;
    if (comboMeta.comboSwapTargetSlugs.length === 0) return;
    if (comboMeta.comboFallbackTargets.length === 0) return;
    const badTargetSet = new Set(comboMeta.comboSwapTargetSlugs);
    const linesToSwap = cartItems.filter((ci) => {
      const s = typeof ci.productSlug === "string" ? ci.productSlug.trim().toLowerCase() : "";
      return s.length > 0 && badTargetSet.has(s);
    });
    if (linesToSwap.length === 0) return;

    swapBusyRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const fallbackSlugs = comboMeta.comboFallbackTargets.map((t) => t.slug).filter(Boolean);
        if (fallbackSlugs.length === 0) return;
        const queue: Array<{ row: (typeof linesToSwap)[number]; payload: Parameters<typeof addToCart>[0] }> = [];
        for (let i = 0; i < linesToSwap.length; i++) {
          const row = linesToSwap[i];
          const targetName = (row.productName || "").toLowerCase();
          
          // Identify the product prefix before the word "combo"
          const prefix = targetName.split("combo")[0].trim();
          
          // Find a fallback that matches this prefix and contains "non combo"
          let matchedFallback = comboMeta.comboFallbackTargets.find((f) => {
            const fn = f.name.toLowerCase();
            return prefix && fn.includes(prefix) && fn.includes("non combo");
          });

          // Fallback to index-based rotation if no specific name match is found
          const fbSlug = matchedFallback ? matchedFallback.slug : fallbackSlugs[i % fallbackSlugs.length];
          
          const payload = await resolveAddPayloadForSlug(fbSlug, row.size);
          if (payload) queue.push({ row, payload });
        }
        if (cancelled || queue.length === 0) return;

        for (const q of queue) {
          removeFromCart(q.row.productId, q.row.size, q.row.sellerId, normalizeOrderMode(q.row.orderMode));
        }

        // Aggregated quantities to add back as fallback lines.
        const currentQtyByKey = new Map<string, number>();
        const linesToKillKeys = new Set(linesToSwap.map(r => `${r.productId}|${r.size}|${r.sellerId}|${normalizeOrderMode(r.orderMode)}`));

        for (const ci of cartItems) {
          const mode = normalizeOrderMode(ci.orderMode);
          const key = `${ci.productId}|${ci.size}|${ci.sellerId}|${mode}`;
          if (linesToKillKeys.has(key)) continue;
          currentQtyByKey.set(key, (currentQtyByKey.get(key) ?? 0) + (Number(ci.quantity) || 0));
        }

        const mergedAdds = new Map<
          string,
          { payload: Parameters<typeof addToCart>[0]; totalQty: number }
        >();
        for (const q of queue) {
          const mode = normalizeOrderMode(q.row.orderMode);
          const nextPayload: Parameters<typeof addToCart>[0] = {
            ...q.payload,
            orderMode: mode,
          };
          const key = `${nextPayload.productId}|${nextPayload.size}|${nextPayload.sellerId}|${mode}`;
          const existingBase = currentQtyByKey.get(key) ?? 0;
          const prevTotal = mergedAdds.get(key)?.totalQty ?? existingBase;
          mergedAdds.set(key, {
            payload: nextPayload,
            totalQty: prevTotal + Math.max(0, Number(q.row.quantity) || 0),
          });
        }
        for (const merged of mergedAdds.values()) {
          addToCart(merged.payload, merged.totalQty);
        }
      } finally {
        swapBusyRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    addToCart,
    cartItems,
    comboMeta.comboFallbackTargets,
    comboMeta.comboRemoveWhenNoTriggerSlugs,
    comboMeta.comboSwapTargetSlugs,
    removeFromCart,
    resolveAddPayloadForSlug,
  ]);

  useEffect(() => {
    setUserOptedOutCoupon(false);
  }, [cartSignature]);

  const packagingForCouponApi = useMemo(() => {
    if (
      couponPackagingByLine &&
      couponPackagingByLine.length === cartItems.length
    ) {
      return couponPackagingByLine;
    }
    return undefined;
  }, [couponPackagingByLine, cartItems.length]);

  useEffect(() => {
    if (cartItems.length === 0) {
      setCouponPackagingByLine(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cart/coupon-packaging", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: cartItems.map((ci) => ({
              productMongoId: ci.mongoProductId,
              legacyProductId: ci.productId,
              size: ci.size,
              sellerId: ci.sellerId,
            })),
          }),
        });
        const json = (await res.json()) as { data?: (ProductPackagingForCoupon | null)[] };
        if (cancelled) return;
        if (res.ok && Array.isArray(json.data) && json.data.length === cartItems.length) {
          setCouponPackagingByLine(json.data);
        } else {
          setCouponPackagingByLine(null);
        }
      } catch {
        if (!cancelled) setCouponPackagingByLine(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  const validateCouponApi = useCallback(
    async (
      code?: string | null
    ): Promise<
      | { ok: true; discountAmount: number; appliedCode: string | null }
      | { ok: false; message: string }
    > => {
      const trimmed = typeof code === "string" ? code.trim().toUpperCase() : "";
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trimmed ? { code: trimmed } : {}),
          lines: cartLinesForCouponApi(cartItems, packagingForCouponApi),
        }),
      });
      let j: CouponValidateResponseJson = {};
      try {
        j = (await res.json()) as CouponValidateResponseJson;
      } catch {
        j = {};
      }
      if (!res.ok) {
        return {
          ok: false,
          message: j.message ?? j.reason ?? "Could not validate coupon",
        };
      }
      if (!j.valid) {
        return {
          ok: false,
          message: j.reason ?? j.message ?? "Coupon not applicable",
        };
      }
      const applied =
        j.appliedCode != null && String(j.appliedCode).trim() !== ""
          ? String(j.appliedCode).trim().toUpperCase()
          : null;
      return {
        ok: true,
        discountAmount: Number(j.discountAmount) || 0,
        appliedCode: applied,
      };
    },
    [cartItems, packagingForCouponApi]
  );

  const autoRunRef = useRef(0);

  useEffect(() => {
    if (cartItems.length === 0) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setAutoCouponBusy(false);
      setCouponRevalidateError(null);
      return;
    }
    if (userOptedOutCoupon) return;

    const runId = ++autoRunRef.current;
    setAutoCouponBusy(true);
    setCouponRevalidateError(null);

    void (async () => {
      try {
        const r = await validateCouponApi();
        if (runId !== autoRunRef.current) return;

        if (r.ok) {
          setAppliedCoupon(r.appliedCode);
          setCouponDiscount(r.discountAmount);
        } else {
          setAppliedCoupon(null);
          setCouponDiscount(0);
        }
      } finally {
        if (runId === autoRunRef.current) {
          setAutoCouponBusy(false);
        }
      }
    })();
  }, [cartSignature, packagingForCouponApi, userOptedOutCoupon, validateCouponApi, cartItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coupons?cart=1", { cache: "no-store" });
        const json = (await res.json()) as { data?: PublicCouponBannerJson[] };
        if (cancelled) return;
        if (res.ok && Array.isArray(json.data)) {
          setCartCoupons(json.data.map(mapPublicCouponToOption));
        }
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setCouponsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cartItems.length > 0) return;
    queueMicrotask(() => {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponRevalidateError(null);
      setCouponPricingMode("combo_first");
      setUserOptedOutCoupon(false);
    });
  }, [cartItems.length, setCouponPricingMode]);

  const handleCouponChange = useCallback(
    async (code: string | null): Promise<CouponApplyResult> => {
      setCouponRevalidateError(null);
      if (!code) {
        setUserOptedOutCoupon(true);
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponPricingMode("combo_first");
        return { ok: true };
      }
      const r = await validateCouponApi(code);
      if (!r.ok) return { ok: false, message: r.message };
      setAppliedCoupon(r.appliedCode ?? code.trim().toUpperCase());
      setCouponDiscount(r.discountAmount);
      setUserOptedOutCoupon(false);
      return { ok: true };
    },
    [validateCouponApi, setCouponPricingMode]
  );

  const openQuotationModal = () => {
    setQuotationOpen(true);
  };

  const submitQuotation = useCallback(
    async (form: QuotationFormValues): Promise<QuotationPdfOrderData> => {
      if (cartItems.length === 0) {
        throw new Error("Your cart is empty.");
      }
      const orderSummary = {
        finalTotal,
        grandTotalInclGst: finalTotal,
        basicTotal: cartBasicTotal,
        gstTotal,
        itemCount: cartGroups.length,
        lineCount: cartItems.length,
        appliedCoupon: appliedCoupon ?? null,
        couponDiscount,
        couponPricingMode,
        minimumOrderInclGst: comboMeta.minimumOrderInclGst,
        minimumOrderMet: comboMeta.minimumOrderMet,
        comboSavingsInclGst: comboMeta.comboSavingsInclGst,
        comboSuggestion: comboMeta.suggestion,
      };
      let res: Response;
      try {
        res = await fetch("/api/quotation-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            customerName: form.fullName,
            phoneNumber: form.phone,
            customerPhone: form.phone,
            customerEmail: form.email,
            companyName: form.companyName,
            gstin: form.gstin,
            addressTitle: form.addressTitle,
            streetAddress: form.streetAddress,
            area: form.area,
            landmark: form.landmark,
            pincode: form.pincode,
            city: form.city,
            state: form.state,
            country: form.country,
            cartItems,
            totalPrice: finalTotal,
            orderSummary,
          }),
        });
      } catch {
        throw new Error("Network error. Check your connection and try again.");
      }
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        data?: QuotationPdfOrderData;
      };
      if (!res.ok) {
        throw new Error(json.message ?? "Could not submit quotation. Try again.");
      }
      if (!json.data?.id || !json.data.serialNo) {
        throw new Error("Invalid response from server.");
      }
      return json.data;
    },
    [
      appliedCoupon,
      cartBasicTotal,
      cartItems,
      cartGroups.length,
      comboMeta.minimumOrderInclGst,
      comboMeta.minimumOrderMet,
      comboMeta.suggestion,
      couponDiscount,
      couponPricingMode,
      comboMeta.comboSavingsInclGst,
      finalTotal,
      gstTotal,
    ]
  );

  const onQuotationSuccess = useCallback(() => {
    setOrderedItems([...cartItems]);
    setOrderedTotal(finalTotal);
    setQuotationOpen(false);
    setSuccessOpen(true);
  }, [cartItems, finalTotal]);

  const handleContinue = () => {
    clearCart();
    setSuccessOpen(false);
    router.push('/');
  };

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ── */}
      <div className={styles.breadcrumbBar}>
        <div className={styles.breadcrumbInner}>
          <Link href="/" className={styles.bcLink}>Home</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className={styles.bcCurrent}>My Cart</span>
        </div>
      </div>

      <div className={styles.inner}>
        {/* ── Page title ── */}
        <div className={styles.pageHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>My Cart</h1>
          </div>
          {cartCount > 0 && (
            <button className={styles.clearBtn} onClick={clearCart}>
              Clear all
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          /* ── Empty state ── */
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>Your cart is empty</h2>
            <p className={styles.emptyText}>Browse our catalogue and add products to your order.</p>
            <Link href="/" className={styles.shopBtn}>
              Browse Products
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        ) : (
          /* ── Cart layout ── */
          <div className={styles.layout}>
            <ComboCartPricingSync onMeta={setComboMeta} />
            {/* Left: Items list */}
            <div className={styles.itemsCol}>
              {comboMeta.suggestion ||
              visibleEligibleTargets.length > 0 ||
              visibleFallbackTargets.length > 0 ? (
                <section
                  className={`${styles.comboGuideCard} ${comboConditionMet ? styles.comboGuideCardSuccess : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <div className={styles.comboGuideHeader}>
                    <span className={styles.comboGuideBadge}>
                      {comboOfferClaimed ? "Offer Claimed" : comboConditionMet ? "Combo Unlocked" : "Combo Offer"}
                    </span>
                    <h3 className={styles.comboGuideTitle}>
                      {comboOfferClaimed
                        ? "🎉 Congrats! Aapka combo offer apply ho gaya"
                        : comboConditionMet
                          ? "Great! Combo unlock ho chuka hai"
                          : "Aapka combo progress"}
                    </h3>
                  </div>
                  {comboOfferClaimed ? (
                    <p className={styles.comboGuideText}>
                      {`Combo net pricing cart mein apply ho chuki hai. Aap abhi tak approx ₹${comboMeta.comboSavingsInclGst.toLocaleString("en-IN")} save kar rahe ho.`}
                    </p>
                  ) : comboConditionMet ? (
                    <p className={styles.comboGuideText}>
                      {visibleEligibleTargets.length === 1
                        ? "Ab bas neeche diya gaya combo product add karke offer claim karo."
                        : "Ab bas neeche diye combo products mein se koi add karke offer claim karo."}
                    </p>
                  ) : (
                    <p className={styles.comboGuideText}>
                      <strong>Combo Unlock Karne ke liye</strong>
                      <br />
                      👉 {comboMeta.suggestion ?? "Sirf thodi aur quantity add karein"}
                      {visibleFallbackTargets[0]?.name ? (
                        <>
                          
                          <br />
                          (combo price cart mein dikhega)
                        </>
                      ) : null}
   
                    </p>
                  )}

                  {visibleEligibleTargets.length > 0 ? (
                    <div className={styles.comboGuideSection}>
                      <p className={styles.comboGuideSectionTitle}>
                        Combo unlocked products (special combo rate):
                      </p>
                      <ul className={styles.comboGuidePills} role="list">
                        {visibleEligibleTargets.map((t) => (
                          <li key={t.slug}>
                            <Link
                              href={`/products/${encodeURIComponent(t.slug)}`}
                              className={styles.comboGuidePill}
                            >
                              {t.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {visibleFallbackTargets.length > 0 ? (
                    <div className={styles.comboGuideSection}>
                      <p className={styles.comboGuideSectionTitle}>
                        Abhi regular rate par add kar sakte ho:
                      </p>
                      <ul className={styles.comboGuidePills} role="list">
                        {visibleFallbackTargets.map((t) => (
                          <li key={t.slug}>
                            <Link
                              href={`/products/${encodeURIComponent(t.slug)}`}
                              className={styles.comboGuidePill}
                            >
                              {t.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <div className={styles.itemsHeader}>
                <h2 className={styles.itemsTitle}>Products</h2>
                <span className={styles.itemsSubtitle}>
                  {cartGroups.length} product{cartGroups.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className={styles.itemsList}>
                {cartGroups.map((lines) => (
                  <CartItemCard
                    key={cartGroupKey(lines[0])}
                    lines={lines}
                    removeFromCart={removeFromCart}
                    removeCartGroup={removeCartGroup}
                    updateQuantity={updateQuantity}
                    addToCart={addToCart}
                  />
                ))}
              </div>

              {/* Policy info bar */}
              <div className={styles.policyBar}>
                <div className={styles.policyItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  100% Advance Payment
                </div>
                <div className={styles.policyItem}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="3" width="15" height="13" rx="2" />
                    <path d="M16 8h4l3 3v5h-7V8z" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  Buyer Arranges Transport
                </div>

                <div
                  className={`${styles.policyItem} ${cartTotal >= comboMeta.minimumOrderInclGst ? styles.policyItemOk : styles.policyItemWarn}`}
                >
                  {cartTotal >= comboMeta.minimumOrderInclGst ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                  {cartTotal >= comboMeta.minimumOrderInclGst
                    ? `Minimum order ₹${comboMeta.minimumOrderInclGst.toLocaleString("en-IN")} met`
                    : `Min. order ₹${comboMeta.minimumOrderInclGst.toLocaleString("en-IN")} · Add ₹${(comboMeta.minimumOrderInclGst - cartTotal).toFixed(0)} more`}
                </div>
              </div>
            </div>

            {/* Right: Order summary */}
            <div className={styles.summaryCol}>
              <OrderSummary
                basicTotal={cartBasicTotal}
                gstTotal={gstTotal}
                minimumOrderInclGst={comboMeta.minimumOrderInclGst}
                itemCount={cartGroups.length}
                items={cartItems}
                cartCoupons={cartCoupons}
                couponsLoaded={couponsLoaded}
                autoCouponBusy={autoCouponBusy}
                userOptedOutCoupon={userOptedOutCoupon}
                appliedCoupon={appliedCoupon}
                couponDiscount={couponDiscount}
                finalTotal={finalTotal}
                couponBannerError={couponRevalidateError}
                onCouponChange={handleCouponChange}
                onPlaceOrder={openQuotationModal}
                comboSavingsInclGst={comboMeta.comboSavingsInclGst}
                couponPricingMode={couponPricingMode}
                onCouponPricingModeChange={setCouponPricingMode}
              />
            </div>
          </div>
        )}
      </div>

      <QuotationDetailsModal
        isOpen={quotationOpen}
        onClose={() => setQuotationOpen(false)}
        submitQuotation={submitQuotation}
        onQuotationSuccess={onQuotationSuccess}
      />

      <OrderSuccessPopup
        isOpen={successOpen}
        items={orderedItems}
        total={orderedTotal}
        onClose={() => setSuccessOpen(false)}
        onContinue={handleContinue}
      />
    </div>
  );
}
