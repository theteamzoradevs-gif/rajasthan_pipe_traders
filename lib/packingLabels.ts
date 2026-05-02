import type { PackingUnitLabels, Product, ProductSize } from "@/app/data/products";
import type { CartItem } from "@/app/context/CartWishlistContext";

export type { PackingUnitLabels };

type PackagingSlice = NonNullable<Product["packaging"]>;

function toTitleWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function pluralLoose(lower: string): string {
  if (lower === "packet") return "pkts";
  if (lower === "box") return "boxes";
  if (lower === "carton") return "cartons";
  if (lower === "bag") return "bags";
  if (lower.endsWith("s") && lower.length > 2) return lower;
  if (lower.endsWith("y") && lower.length > 1 && !/[aeiou]y$/i.test(lower)) {
    return lower.slice(0, -1) + "ies";
  }
  if (/(s|x|z|ch|sh)$/i.test(lower)) return lower + "es";
  return lower + "s";
}

function outerFromSegment(segment: string): Partial<PackingUnitLabels> | undefined {
  const s = segment.trim();
  if (!s) return undefined;
  if (s.startsWith("custom:")) {
    const label = s.slice(7).trim();
    if (!label) return undefined;
    const low = label.toLowerCase();
    return {
      outer: low,
      outerPlural: pluralLoose(low),
      outerHeading: toTitleWords(label),
    };
  }
  switch (s) {
    case "per_bag":
    case "per_master_bag":
      return { outer: "bag", outerPlural: "bags", outerHeading: "Master Bag" };
    case "per_cartoon":
      return { outer: "carton", outerPlural: "cartons", outerHeading: "Carton" };
    default:
      return undefined;
  }
}

function innerFromSegment(segment: string): Partial<PackingUnitLabels> | undefined {
  const s = segment.trim();
  if (!s) return undefined;
  if (s.startsWith("custom:")) {
    const label = s.slice(7).trim();
    if (!label) return undefined;
    const low = label.toLowerCase();
    return {
      inner: low,
      innerPlural: pluralLoose(low),
      innerHeading: toTitleWords(label),
    };
  }
  switch (s) {
    case "per_packet":
      return { inner: "packet", innerPlural: "pkts", innerHeading: "Packet" };
    case "per_box":
      return { inner: "box", innerPlural: "boxes", innerHeading: "Box" };
    case "per_piece":
      return { inner: "piece", innerPlural: "pcs", innerHeading: "Piece" };
    case "per_dozen":
      return { inner: "dozen", innerPlural: "dozens", innerHeading: "Dozen" };
    default:
      return undefined;
  }
}

function firstBulkSegment(pack: PackagingSlice): string | undefined {
  const raw = pack.bulkUnitChoices;
  if (Array.isArray(raw) && raw[0]) return String(raw[0]);
  const u = pack.pricingUnit;
  if (u === "per_bag" || u === "per_master_bag" || u === "per_cartoon") return u;
  return undefined;
}

function firstInnerSegment(pack: PackagingSlice): string | undefined {
  const raw = pack.innerUnitChoices;
  if (Array.isArray(raw) && raw[0]) return String(raw[0]);
  const u = pack.pricingUnit;
  if (
    u === "per_packet" ||
    u === "per_box" ||
    u === "per_piece" ||
    u === "per_dozen"
  ) {
    return u;
  }
  return undefined;
}

/** Derive display labels from Mongo `packaging` (admin unit choices) when `packingUnitLabels` is sparse. */
export function derivePackingUnitLabelsFromPackaging(
  packaging: PackagingSlice | undefined
): Partial<PackingUnitLabels> | undefined {
  if (!packaging) return undefined;
  const bulk = firstBulkSegment(packaging);
  const inner = firstInnerSegment(packaging);
  const o = bulk ? outerFromSegment(bulk) : undefined;
  const i = inner ? innerFromSegment(inner) : undefined;
  if (!o && !i) return undefined;
  return { ...o, ...i };
}

const DEFAULT_LABELS: PackingUnitLabels = {
  inner: "packet",
  innerPlural: "pkts",
  outer: "bag",
  outerPlural: "bags",
  outerHeading: "Master Bag",
  innerHeading: "Packet",
};

/** Category-level defaults (price list terminology). */
const CATEGORY_DEFAULTS: Record<string, Partial<PackingUnitLabels>> = {
  "Boxes & Plates": {
    inner: "box",
    innerPlural: "boxes",
    outer: "carton",
    outerPlural: "cartons",
    outerHeading: "Carton",
    innerHeading: "Box",
  },
  Sanitaryware: {
    inner: "box",
    innerPlural: "boxes",
    outer: "carton",
    outerPlural: "cartons",
    outerHeading: "Carton",
    innerHeading: "Box",
  },
};

function mergeLabels(
  base: PackingUnitLabels,
  ...partials: (Partial<PackingUnitLabels> | undefined)[]
): PackingUnitLabels {
  let out = { ...base };
  for (const p of partials) {
    if (!p) continue;
    out = { ...out, ...p };
  }
  return out;
}

export function resolvePackingUnitLabels(product: Product, size: ProductSize): PackingUnitLabels {
  const cat = CATEGORY_DEFAULTS[product.category];
  const fromPackaging = derivePackingUnitLabelsFromPackaging(product.packaging);
  return mergeLabels(
    DEFAULT_LABELS,
    cat,
    fromPackaging,
    product.packingUnitLabels,
    size.packingLabels
  );
}

/** When only category is known (e.g. hero carousel stubs without full `Product`). */
export function defaultPackingLabelsForCategory(category: string): PackingUnitLabels {
  return mergeLabels(DEFAULT_LABELS, CATEGORY_DEFAULTS[category]);
}

/** Cart line only has category + size fields — enough for label resolution */
export function resolvePackingLabelsForCartLine(line: CartItem): PackingUnitLabels {
  const product = {
    category: line.category,
  } as Product;
  const size = {
    size: line.size,
    basicPrice: line.basicPricePerUnit,
    withGST: line.pricePerUnit,
    qtyPerBag: line.qtyPerBag,
    pcsPerPacket: line.pcsPerPacket,
  } as ProductSize;
  return resolvePackingUnitLabels(product, size);
}
