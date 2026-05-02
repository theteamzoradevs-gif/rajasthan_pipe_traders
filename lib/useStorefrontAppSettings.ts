"use client";

import { useEffect, useState } from "react";

export type StorefrontAppSettingsState = {
  minimumOrderInclGst: number;
  pricesEffectiveDate: string;
};

const DEFAULT_MOV = 25_000;

const initial: StorefrontAppSettingsState = {
  minimumOrderInclGst: DEFAULT_MOV,
  pricesEffectiveDate: "",
};

/** Public storefront settings from `/api/app-settings` (Store settings in admin). */
export function useStorefrontAppSettings(): StorefrontAppSettingsState {
  const [state, setState] = useState<StorefrontAppSettingsState>(initial);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/app-settings", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        const mov = json.data?.minimumOrderInclGst;
        const ped = json.data?.pricesEffectiveDate;
        setState({
          minimumOrderInclGst:
            typeof mov === "number" && Number.isFinite(mov) && mov >= 0 ? mov : DEFAULT_MOV,
          pricesEffectiveDate:
            typeof ped === "string" && ped.trim() ? ped.trim() : "",
        });
      } catch {
        // keep initial
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
