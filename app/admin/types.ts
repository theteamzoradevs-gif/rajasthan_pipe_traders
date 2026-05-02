export type CategoryParent = { _id: string; name: string; slug: string } | null;

export type AdminCategory = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent: CategoryParent;
  sortOrder: number;
  sourceSectionLabel?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PopulatedCategory = { _id: string; name: string; slug: string };

export type CouponPacketTier = { minPackets: number; value: number };

export type CouponTierUnit = "packets" | "outer";

export type ComboThresholdUnit = "packets" | "bags" | "cartons";

export type AdminComboRule = {
  _id: string;
  name: string;
  triggerSlugs: string[];
  targetSlugs: string[];
  fallbackTargetSlugs?: string[];
  triggerCategoryIds?: string[];
  targetCategoryIds?: string[];
  fallbackCategoryIds?: string[];
  minTriggerBags: number;
  minTargetBags: number;
  triggerThresholdUnit: ComboThresholdUnit;
  targetThresholdUnit: ComboThresholdUnit;
  /** @deprecated Optional legacy; combo net rates come from product size rows. */
  comboPriceInclGst?: number;
  suggestionMessage?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminCoupon = {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "flat";
  /** Tier thresholds: packet totals vs outer cartons/master bags */
  tierUnit?: CouponTierUnit;
  packetTiers: CouponPacketTier[];
  applicableProductIds: string[];
  applicableCategoryIds: string[];
  applicableProducts?: Array<{ _id: string; sku?: string; name?: string; slug?: string }>;
  applicableCategories?: Array<{ _id: string; name?: string; slug?: string }>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminProduct = {
  _id: string;
  sku?: string;
  productKind: "sku" | "catalog";
  slug?: string;
  name: string;
  description?: string;
  category: PopulatedCategory;
  sortOrder?: number;
  brand?: string;
  image?: string;
  images?: string[];
  isActive: boolean;
  isNew?: boolean;
  pricing: {
    basicPrice: number;
    priceWithGst: number;
    currency?: string;
  };
};
