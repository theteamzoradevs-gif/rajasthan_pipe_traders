import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetail from "../../components/ProductDetail/ProductDetail";
import { getProductBySlug, getRelatedProducts, products } from "../../data/products";
import { apiProductToProduct } from "../../lib/api/mapApiProduct";
import type { ApiProduct } from "../../lib/api/types";
import { getStorefrontProductBySlug, getStorefrontRelatedProducts } from "@/lib/catalog/storefront";
import { sortProductsForDisplayOrder } from "@/app/lib/sortApiProductsDisplay";
import { loadActiveComboGuardRules } from "@/lib/combo/loadActiveComboGuardRules";
import {
  comboTargetPdpNoticeInfo,
  COMBO_TARGET_PDP_DEFAULT_INTRO_FALLBACK,
  isComboTriggerSlug,
  type ComboTargetAddBlockedInfo,
} from "@/lib/combo/comboAddGuard";

const RELATED_FETCH_LIMIT = 50;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/* ── Static Params (SSG) ── */
export async function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

/* ── Dynamic Metadata ── */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const staticProduct = getProductBySlug(slug);
  if (staticProduct) {
    return {
      title: `${staticProduct.name} | Rajasthan Pipe Traders`,
      description: staticProduct.description,
      keywords: [staticProduct.brand, staticProduct.category, staticProduct.subCategory, ...staticProduct.tags].join(", "),
      openGraph: {
        title: `${staticProduct.name} | Rajasthan Pipe Traders`,
        description: staticProduct.description,
        images: [staticProduct.image],
      },
    };
  }

  const doc = await getStorefrontProductBySlug(slug);
  if (!doc) {
    return { title: "Product Not Found | Rajasthan Pipe Traders" };
  }
  const product = apiProductToProduct(doc as unknown as ApiProduct);
  return {
    title: `${product.name} | Rajasthan Pipe Traders`,
    description: product.description,
    keywords: [product.brand, product.category, product.subCategory, ...product.tags].join(", "),
    openGraph: {
      title: `${product.name} | Rajasthan Pipe Traders`,
      description: product.description,
      images: [product.image],
    },
  };
}

/* ── Page Component ── */
export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  const staticProduct = getProductBySlug(slug);
  if (staticProduct) {
    const relatedProducts = getRelatedProducts(staticProduct, Number.MAX_SAFE_INTEGER);
    return <ProductDetail product={staticProduct} relatedProducts={relatedProducts} />;
  }

  const doc = await getStorefrontProductBySlug(slug);
  if (!doc) {
    notFound();
  }

  const product = apiProductToProduct(doc as unknown as ApiProduct);
  const cat = doc.category as { _id?: string } | undefined;
  const categoryMongoId = typeof cat?._id === "string" ? cat._id : undefined;
  const relatedCandidates = await getStorefrontRelatedProducts(
    categoryMongoId,
    String(doc._id),
    RELATED_FETCH_LIMIT
  );
  const relatedProducts = sortProductsForDisplayOrder(relatedCandidates);

  let comboTargetPdpNotice: ComboTargetAddBlockedInfo | undefined;
  let comboTriggerPdpMessage: string | undefined;
  let comboTriggerTargetSlugs: string[] | undefined;
  let comboTriggerTargetNames: Record<string, string> | undefined;
  try {
    const rules = await loadActiveComboGuardRules();
    if (product.isEligibleForCombo === true) {
      comboTargetPdpNotice =
        comboTargetPdpNoticeInfo(product.slug, rules) ?? {
          message: COMBO_TARGET_PDP_DEFAULT_INTRO_FALLBACK,
          qualifyingProductSlugs: [],
        };
    }
    if (isComboTriggerSlug(product.slug, rules)) {
      const normalized = product.slug.trim().toLowerCase();
      const target = new Set<string>();
      for (const r of rules) {
        const isTrigger = r.triggerSlugs.some((s) => s.trim().toLowerCase() === normalized);
        if (!isTrigger) continue;
        for (const s of r.targetSlugs ?? []) {
          const t = String(s).trim().toLowerCase();
          if (t) target.add(t);
        }
      }
      comboTriggerTargetSlugs = [...target];
      const nameBySlug: Record<string, string> = {};
      const targetNamePriceLines: string[] = [];

      let minTargetPriceWithGst: number | null = null;
      let minTargetSizeLabel: string | null = null;
      if (comboTriggerTargetSlugs.length > 0) {
        const targetDocs = await Promise.all(comboTriggerTargetSlugs.map((s) => getStorefrontProductBySlug(s)));
        for (let i = 0; i < targetDocs.length; i++) {
          const tDoc = targetDocs[i];
          const slugKey = comboTriggerTargetSlugs[i];
          if (slugKey && tDoc && typeof tDoc.name === "string" && tDoc.name.trim()) {
            nameBySlug[slugKey] = tDoc.name.trim();
          }
          if (!tDoc) continue;
          const targetProduct = apiProductToProduct(tDoc as unknown as ApiProduct);
          const firstOffer = targetProduct.sellers?.[0];
          const firstSize = firstOffer?.sizes?.[0];
          const pricingFromDoc = Number(
            (tDoc as { pricing?: { priceWithGst?: unknown } }).pricing?.priceWithGst
          );
          const candidate =
            typeof firstSize?.withGST === "number" && Number.isFinite(firstSize.withGST)
              ? firstSize.withGST
              : Number.isFinite(pricingFromDoc)
                ? pricingFromDoc
                : undefined;
          if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) continue;
          const cleanName = String(targetProduct.name ?? "")
            .replace(/\b\d+(?:\.\d+)?\s*MM\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim()
            .toUpperCase();
          const displayLine = `${cleanName || String(slugKey || "").toUpperCase()} ₹${candidate.toFixed(2)}`;
          targetNamePriceLines.push(displayLine);
          if (minTargetPriceWithGst == null || candidate < minTargetPriceWithGst) {
            minTargetPriceWithGst = candidate;
            const rawSize = String(firstSize?.size ?? "").trim();
            minTargetSizeLabel = rawSize || null;
          }
        }
      }
      comboTriggerTargetNames = Object.keys(nameBySlug).length > 0 ? nameBySlug : undefined;

      const displaySize = minTargetSizeLabel || "20MM";
      const displayPrice =
        minTargetPriceWithGst == null
          ? "54"
          : Number.isInteger(minTargetPriceWithGst)
            ? String(minTargetPriceWithGst)
            : minTargetPriceWithGst.toFixed(2);

      const topTwoTargets = targetNamePriceLines.slice(0, 2);
      comboTriggerPdpMessage =
        topTwoTargets.length > 0
          ? `Eligible quantity add karo aur combo unlock karo — ${topTwoTargets.join(" • ")}. Offer claim karne ke liye koi ek qualifying bags cart me add karein.`
          : `Eligible quantity add karo aur combo unlock karo — ${displaySize} combo products ab sirf ₹${displayPrice} se start. Offer claim karne ke liye qualifying bags cart me add karein.`;
    }
  } catch {
    if (product.isEligibleForCombo === true) {
      comboTargetPdpNotice = {
        message: COMBO_TARGET_PDP_DEFAULT_INTRO_FALLBACK,
        qualifyingProductSlugs: [],
      };
    }
  }

  return (
    <ProductDetail
      product={product}
      relatedProducts={relatedProducts}
      comboTargetPdpNotice={comboTargetPdpNotice}
      comboTriggerPdpMessage={comboTriggerPdpMessage}
      comboTriggerTargetSlugs={comboTriggerTargetSlugs}
      comboTriggerTargetNames={comboTriggerTargetNames}
    />
  );
}
