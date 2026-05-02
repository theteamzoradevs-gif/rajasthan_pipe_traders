import type {
  KeyFeatureIcon,
  KeyFeatureLine,
  Product,
  ProductListingEntry,
  ProductSellerOffer,
  ProductSize,
} from "../../data/products";
import { expandProductsForListing } from "../../data/products";
import { getApiBaseUrl, resolveAssetUrl } from "./baseUrl";
import type {
  ApiPricing,
  ApiProduct,
  ApiProductSize,
  ApiProductSellerOffer,
} from "./types";

function stableNumericId(mongoId: string): number {
  let h = 0;
  for (let i = 0; i < mongoId.length; i++) {
    h = (Math.imul(31, h) + mongoId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

type PackagingFields = NonNullable<ApiProduct["packaging"]>;

function enrichSizeFromPackaging(s: ApiProductSize, packaging: PackagingFields | undefined): ApiProductSize {
  const ppp =
    s.pcsPerPacket ??
    packaging?.pcsPerPacket ??
    packaging?.pcsInPacket ??
    1;
  const qpb =
    s.qtyPerBag ??
    packaging?.packetsInMasterBag ??
    packaging?.pktInMasterBag ??
    0;
  return {
    ...s,
    pcsPerPacket: ppp,
    qtyPerBag: qpb,
  };
}

function mapApiSize(s: ApiProductSize): ProductSize {
  const row: ProductSize = {
    size: s.size,
    basicPrice: s.basicPrice,
    withGST: s.priceWithGst,
    qtyPerBag: s.qtyPerBag ?? 0,
    pcsPerPacket: s.pcsPerPacket ?? 1,
    note: s.note,
    packingLabels: s.packingLabels,
  };
  if (s.comboBasicPrice != null) row.comboBasicPrice = s.comboBasicPrice;
  if (s.comboPriceWithGst != null) row.comboPriceWithGst = s.comboPriceWithGst;
  if (s.coreComboVariant === "20" || s.coreComboVariant === "25") row.coreComboVariant = s.coreComboVariant;
  if (s.countsTowardComboEligible === true || s.countsTowardComboEligible === false) {
    row.countsTowardComboEligible = s.countsTowardComboEligible;
  }
  return row;
}

function mapApiKeyFeatures(raw: unknown): KeyFeatureLine[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: KeyFeatureLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as { text?: unknown; icon?: unknown };
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) continue;
    const ic = o.icon;
    const icon: KeyFeatureIcon =
      ic === "material" || ic === "dot" || ic === "check" ? ic : "check";
    out.push({ text, icon });
  }
  return out.length ? out : undefined;
}

function mapSellerOffer(
  s: ApiProductSellerOffer,
  pricing: ApiPricing,
  packaging: PackagingFields | undefined,
  productBrand?: string
): ProductSellerOffer {
  let sizes = (s.sizes ?? []).map((sz) => mapApiSize(enrichSizeFromPackaging(sz, packaging)));
  if (sizes.length === 0) {
    sizes = [
      {
        size: "Standard",
        basicPrice: pricing.basicPrice,
        withGST: pricing.priceWithGst,
        qtyPerBag: 0,
        pcsPerPacket: 1,
      },
    ];
  }
  const offerBrand =
    typeof s.brand === "string" && s.brand.trim() ? s.brand.trim() : (productBrand?.trim() ?? "");
  return {
    sellerId: s.sellerId,
    sellerName: s.sellerName,
    brand: offerBrand,
    sizes,
    discountTiers: s.discountTiers ?? [],
    minOrder: s.minOrder ?? "",
    note: s.note,
  };
}

function catalogSlugFromSku(sku: string): string {
  const upper = sku.toUpperCase();
  if (upper.startsWith("CAT-")) return upper.slice(4).toLowerCase().replace(/_/g, "-");
  return sku.toLowerCase().replace(/_/g, "-");
}

export function apiProductToProduct(p: ApiProduct): Product {
  const baseUrl = getApiBaseUrl();
  const primaryImage = resolveAssetUrl(p.image ?? p.images?.[0], baseUrl);
  const gallery = (p.images ?? []).map((path) => resolveAssetUrl(path, baseUrl));

  const categoryName = p.category?.name ?? "";
  const packaging = p.packaging;

  let sizes: ProductSize[] = [];
  let sellers: ProductSellerOffer[] | undefined;

  if (p.sellers && p.sellers.length > 0) {
    sellers = p.sellers.map((s) => mapSellerOffer(s, p.pricing, packaging, p.brand));
  } else if (p.sizes && p.sizes.length > 0) {
    sizes = p.sizes.map((s) => mapApiSize(enrichSizeFromPackaging(s, packaging)));
  } else {
    const qpb =
      packaging?.packetsInMasterBag ??
      packaging?.pktInMasterBag ??
      0;
    const ppp = packaging?.pcsPerPacket ?? packaging?.pcsInPacket ?? 1;
    sizes = [
      {
        size: p.sizeOrModel?.trim() || "Standard",
        basicPrice: p.pricing.basicPrice,
        withGST: p.pricing.priceWithGst,
        qtyPerBag: qpb,
        pcsPerPacket: ppp,
      },
    ];
  }

  const slug =
    (p.slug && p.slug.trim()) ||
    (p.productKind === "catalog" && p.sku
      ? catalogSlugFromSku(p.sku)
      : p.sku
        ? p.sku.toLowerCase()
        : `p-${p._id.toLowerCase()}`);

  const brandTrim =
    typeof p.brand === "string" && p.brand.trim() ? p.brand.trim() : "";

  return {
    id: p.legacyId ?? stableNumericId(p._id),
    mongoProductId: p._id,
    categoryMongoId: p.category?._id,
    slug,
    name: p.name,
    brand: brandTrim,
    category: categoryName,
    ...(typeof p.sortOrder === "number" ? { sortOrder: p.sortOrder } : {}),
    ...(typeof p.categorySortOrder === "number" ? { categorySortOrder: p.categorySortOrder } : {}),
    subCategory: p.subCategory ?? "",
    description: p.description ?? "",
    /** PDP “About this product” — admin often fills only `description`; use it when `longDescription` is unset */
    longDescription: (() => {
      const long = typeof p.longDescription === "string" ? p.longDescription.trim() : "";
      if (long) return long;
      return typeof p.description === "string" ? p.description.trim() : "";
    })(),
    features: p.features ?? [],
    keyFeatures: mapApiKeyFeatures(p.keyFeatures),
    image: primaryImage,
    images: gallery.length ? gallery : [primaryImage],
    isNew: p.isNew ?? false,
    isIsiCertified: p.isIsiCertified === true,
    isBestseller: p.isBestseller,
    tags: p.tags ?? [],
    sizes,
    discountTiers: p.discountTiers ?? [],
    sellers,
    note: p.note,
    minOrder: p.minOrder ?? "",
    certifications: p.certifications,
    material: p.material,
    moq: p.moq,
    moqBags: p.moqBags,
    packingUnitLabels: p.packingUnitLabels,
    packaging: p.packaging
      ? {
          bulkUnitChoices: p.packaging.bulkUnitChoices,
          innerUnitChoices: p.packaging.innerUnitChoices,
          pricingUnit: p.packaging.pricingUnit,
        }
      : undefined,
    isEligibleForCombo: p.isEligibleForCombo,
  };
}

export function apiProductsToListingEntries(products: ApiProduct[]): ProductListingEntry[] {
  return expandProductsForListing(products.map(apiProductToProduct));
}
