import type { ProductListingEntry } from "@/app/data/products";

export interface ListingMoqCartModel {
  productId: number;
  mongoProductId?: string;
  categoryMongoId?: string;
  productSlug: string;
  productImage: string;
  productName: string;
  brand: string;
  category: string;
  sellerId: string;
  sellerName: string;
  size: string;
  pricePerUnit: number;
  basicPricePerUnit: number;
  qtyPerBag: number;
  pcsPerPacket: number;
  moq?: number;
  moqBags?: number;
}

/** Hero carousel stub product (inline slide data — no full `Product` document). */
export function heroSlideProductToModel(p: {
  id: number;
  mongoProductId?: string;
  slug: string;
  name: string;
  image: string;
  brand: string;
  category: string;
  sellerId: string;
  sellerName: string;
  firstSize: string;
  firstWithGST: number;
  firstBasic: number;
  qtyPerBag: number;
  pcsPerPacket: number;
}): ListingMoqCartModel {
  return {
    productId: p.id,
    mongoProductId: p.mongoProductId,
    productSlug: p.slug,
    productImage: p.image,
    productName: p.name,
    brand: p.brand,
    category: p.category,
    sellerId: p.sellerId,
    sellerName: p.sellerName,
    size: p.firstSize,
    pricePerUnit: p.firstWithGST,
    basicPricePerUnit: p.firstBasic,
    qtyPerBag: p.qtyPerBag,
    pcsPerPacket: p.pcsPerPacket,
  };
}

export function listingEntryToModel(entry: ProductListingEntry): ListingMoqCartModel {
  const s = entry.offer.sizes[0];
  return {
    productId: entry.product.id,
    mongoProductId: entry.product.mongoProductId,
    categoryMongoId: entry.product.categoryMongoId,
    productSlug: entry.product.slug,
    productImage: entry.product.image,
    productName: entry.product.name,
    brand: entry.offer.brand,
    category: entry.product.category,
    sellerId: entry.offer.sellerId,
    sellerName: entry.offer.sellerName,
    size: s.size,
    pricePerUnit: s.withGST,
    basicPricePerUnit: s.basicPrice,
    qtyPerBag: s.qtyPerBag,
    pcsPerPacket: s.pcsPerPacket,
    moq: entry.product.moq,
    moqBags: entry.product.moqBags,
  };
}
