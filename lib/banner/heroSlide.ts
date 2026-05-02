import type { ApiProduct } from "@/app/lib/api/types";
import { apiProductToProduct } from "@/app/lib/api/mapApiProduct";
import { expandProductsForListing } from "@/app/data/products";

/** Shape consumed by `HeroBanner` / `ProductCarousel` (matches former inline `slides` entries). */
export interface HeroSlideProduct {
  id: number;
  mongoProductId?: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  image: string;
  sellerId: string;
  sellerName: string;
  firstWithGST: number;
  firstBasic: number;
  firstSize: string;
  qtyPerBag: number;
  pcsPerPacket: number;
}

export interface HeroSlide {
  tag: string;
  tagKey: string;
  product: HeroSlideProduct;
}

export function buildHeroSlideFromApiProduct(
  api: ApiProduct,
  meta: { tag: string; tagKey: string }
): HeroSlide | null {
  const prod = apiProductToProduct(api);
  const entries = expandProductsForListing([prod]);
  if (entries.length === 0) return null;
  const e = entries[0];
  const s = e.offer.sizes[0];
  if (!s) return null;
  return {
    tag: meta.tag,
    tagKey: meta.tagKey,
    product: {
      id: prod.id,
      mongoProductId: prod.mongoProductId,
      slug: prod.slug,
      name: prod.name,
      brand: e.offer.brand,
      category: prod.category,
      description: prod.description,
      image: prod.image,
      sellerId: e.offer.sellerId,
      sellerName: e.offer.sellerName,
      firstWithGST: s.withGST,
      firstBasic: s.basicPrice,
      firstSize: s.size,
      qtyPerBag: s.qtyPerBag,
      pcsPerPacket: s.pcsPerPacket,
    },
  };
}
