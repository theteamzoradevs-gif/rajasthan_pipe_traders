"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./HeroBanner.module.css";
import { productHeading, brandPillLabel, resolveBrandPillVariant } from "../../lib/productHeading";
import { resolvePackingUnitLabels } from "@/lib/packingLabels";
import type { Product, ProductSize } from "@/app/data/products";
import ListingMoqCartControls from "@/app/components/ListingMoqCartControls/ListingMoqCartControls";
import { heroSlideProductToModel } from "@/lib/cart/listingMoqModel";
import type { HomeBannerPayload } from "@/lib/banner/resolveHomeBanner";
import type { HeroSlide } from "@/lib/banner/heroSlide";

/* ════════════════════════════════════
   COUPON DATA (from /api/coupons)
════════════════════════════════════ */
const COUPON_THEMES = new Set(["blue", "indigo", "green", "amber", "brown"]);

type BannerCoupon = {
  code: string;
  discount: string;
  label: string;
  condition: string;
  desc: string;
  theme: string;
};

function normalizeBannerCoupon(raw: Record<string, unknown>): BannerCoupon {
  const theme = typeof raw.theme === "string" && COUPON_THEMES.has(raw.theme) ? raw.theme : "blue";
  return {
    code: String(raw.code ?? ""),
    discount: String(raw.discount ?? ""),
    label: String(raw.label ?? ""),
    condition: String(raw.condition ?? ""),
    desc: String(raw.desc ?? ""),
    theme,
  };
}

/* ════════════════════════════════════
   COUPON CARD COMPONENT
════════════════════════════════════ */
function CouponCard({ c }: { c: BannerCoupon }) {
  return (
    <div className={`${styles.coupon} ${styles[`coupon_${c.theme}`]}`}>
      <div className={styles.couponNotchL} aria-hidden />
      <div className={styles.couponNotchR} aria-hidden />

      <div className={styles.couponStub}>
        <div className={styles.couponDiscBlock}>
          <span className={styles.couponPct}>{c.discount}</span>
          <span className={styles.couponLabel}>{c.label}</span>
        </div>
      </div>

      <div className={styles.couponDash} aria-hidden />

      <div className={styles.couponBody}>
        <p className={styles.couponCond}>{c.condition}</p>
        <p className={styles.couponDescTxt}>{c.desc}</p>
        <div className={`${styles.couponCode} ${styles[`couponCode_${c.theme}`]}`}>
          {c.code}
        </div>
      </div>
    </div>
  );
}

function HeroBackground({ src }: { src: string }) {
  const isLocal = src.startsWith("/");
  if (isLocal) {
    return (
      <div className={styles.bgImage}>
        <Image
          src={src}
          alt="Rajasthan Pipe Traders"
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
          priority
        />
      </div>
    );
  }
  return (
    <div className={styles.bgImage}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
      />
    </div>
  );
}

/* ════════════════════════════════════
   PRODUCT CAROUSEL
════════════════════════════════════ */
function ProductCarousel({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<"l" | "r">("l");
  const [paused, setPaused] = useState(false);


  const goTo = useCallback((i: number, d: "l" | "r" = "l") => {
    setDir(d);
    setActive(i);
  }, []);
  const next = useCallback(() => goTo((active + 1) % slides.length, "l"), [active, goTo, slides.length]);
  const prev = useCallback(
    () => goTo((active - 1 + slides.length) % slides.length, "r"),
    [active, goTo, slides.length]
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(next, 3500);
    return () => clearInterval(t);
  }, [paused, next, slides.length]);

  if (slides.length === 0) return null;

  const s = slides[active];
  const p = s.product;
  const productMin = { category: p.category } as Product;
  const sizeMin = {
    size: p.firstSize,
    basicPrice: p.firstBasic,
    withGST: p.firstWithGST,
    qtyPerBag: p.qtyPerBag,
    pcsPerPacket: p.pcsPerPacket,
  } as ProductSize;
  const heroLabels = resolvePackingUnitLabels(productMin, sizeMin);
  const brandSource = (p.brand || "").trim();
  const heroPillLabel = brandPillLabel(brandSource);
  const heroVariant = resolveBrandPillVariant(brandSource);
  const slidePillClass =
    heroVariant === "hitech"
      ? styles.slideListingBrandHitech
      : heroVariant === "tejas"
        ? styles.slideListingBrandTejas
        : heroVariant === "nstar"
          ? styles.slideListingBrandNstar
          : styles.slideListingBrandDefault;

  return (
    <div className={styles.carousel} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(true)}>
      <div
        key={active}
        className={`${styles.slideCard} ${styles[`tag_${s.tagKey}`]} ${styles[dir === "l" ? "animL" : "animR"]}`}
      >
        <span className={`${styles.slideTag} ${styles[`tagBg_${s.tagKey}`]}`}>{s.tag}</span>

        <Link href={`/products/${p.slug}`} className={styles.slideImg}>
          <Image
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 60vw, 30vw"
            style={{ objectFit: "contain", padding: "1.25rem" }}
          />
          <div className={`${styles.imgGlow} ${styles[`glow_${s.tagKey}`]}`} aria-hidden />
        </Link>

        <div className={styles.slideContent}>
          {heroPillLabel ? (
            <span className={`${styles.slideListingBrand} ${slidePillClass}`}>{heroPillLabel}</span>
          ) : null}
          <h3 className={styles.slideName}>{productHeading(p.name, p.firstSize)}</h3>
          <p className={styles.slideDesc}>{p.description}</p>
          <div className={styles.slidePriceRow}>
            <div>
              <span className={styles.slideFrom}>from </span>
              <span className={styles.slidePrice}>₹{p.firstWithGST.toFixed(2)}</span>
              <span className={styles.slideGst}> incl. GST / {heroLabels.inner}</span>
            </div>
            <span className={styles.slideBasic}>₹{p.firstBasic.toFixed(2)} basic</span>
          </div>

          <div className={styles.slideCtaRow} onClick={(e) => e.stopPropagation()}>
            <ListingMoqCartControls
              model={heroSlideProductToModel(p)}
              labels={heroLabels}
              className={styles.slideListingMoq}
              compact
              stackRows
              cardListingLayout
            />
          </div>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className={styles.carouselNav}>
          <button className={styles.arrowBtn} type="button" onClick={prev}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.dots}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
                onClick={() => goTo(i, i > active ? "l" : "r")}
              />
            ))}
          </div>
          <button className={styles.arrowBtn} type="button" onClick={next}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════
   MAIN HERO
════════════════════════════════════ */
export default function HeroBanner({ banner }: { banner: HomeBannerPayload }) {
  const [bannerCoupons, setBannerCoupons] = useState<BannerCoupon[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coupons?banner=1", { cache: "no-store" });
        const json = (await res.json()) as { data?: unknown[] };
        if (cancelled) return;
        if (!res.ok || !Array.isArray(json.data)) return;
        setBannerCoupons(json.data.map((row) => normalizeBannerCoupon(row as Record<string, unknown>)));
      } catch {
        /* keep empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCarouselSlides = banner.slides.length > 0;

  return (
    <section className={styles.hero}>
      <HeroBackground src={banner.backgroundImageUrl} />
      <div className={styles.overlayLeft} aria-hidden />
      <div className={styles.overlayFull} aria-hidden />
      <div className={styles.bgGrid} aria-hidden />

      {bannerCoupons.length > 0 ? (
        <div className={styles.couponBar}>
          <div className={styles.couponBarInner}>
            <div className={styles.couponRow}>
              {bannerCoupons.map((c, i) => (
                <CouponCard key={`${c.code}-a-${i}`} c={c} />
              ))}
              {bannerCoupons.map((c, i) => (
                <CouponCard key={`${c.code}-b-${i}`} c={c} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${styles.inner} ${hasCarouselSlides ? "" : styles.innerNoCarousel}`}>
        <div className={styles.left}>
          <div className={styles.trustBadge}>
            <span className={styles.trustDot} />
            {banner.trustBadgeText}
          </div>

          <h1 className={styles.headline}>
            <span className={styles.companyName}>{banner.headlinePart1.trimEnd()}</span>
            {" "}
            <span className={styles.companyName2}>{banner.headlinePart2.trimStart()}</span>
          </h1>

          <p className={styles.tagline}>{banner.tagline}</p>

          <p className={styles.subtext} dangerouslySetInnerHTML={{ __html: banner.subtextHtml }} />

          <div className={styles.statsRow}>
            {banner.stats.map((s, i) => (
              <React.Fragment key={`${s.label}-${i}`}>
                {i > 0 && <div className={styles.statsDivider} />}
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {hasCarouselSlides ? (
          <div className={styles.right}>
            <ProductCarousel slides={banner.slides} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
