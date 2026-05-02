"use client";

import { useStorefrontAppSettings } from "./useStorefrontAppSettings";

/** Thin wrapper when only the effective date string is needed. */
export function usePricesEffectiveDate() {
  return useStorefrontAppSettings().pricesEffectiveDate;
}
