"use client";

import React from "react";
import { useStorefrontAppSettings } from "@/lib/useStorefrontAppSettings";

type Props = {
  className?: string;
};

/** Footer line: min order (admin) · 100% advance · prices effective (admin). */
export default function StorefrontPolicyFooterNote({ className }: Props) {
  const { minimumOrderInclGst, pricesEffectiveDate } = useStorefrontAppSettings();
  const movStr = minimumOrderInclGst.toLocaleString("en-IN");
  const tail = pricesEffectiveDate ? ` · Prices effective ${pricesEffectiveDate}` : "";

  return (
    <p className={className}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      {`Min. order ₹${movStr} (incl. GST) · 100% advance${tail}`}
    </p>
  );
}
