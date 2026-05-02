import { NextResponse } from "next/server";
import { loadActiveComboGuardRules } from "@/lib/combo/loadActiveComboGuardRules";
import { logApiRouteError } from "@/lib/http/apiError";

/**
 * Public: active combo rules for add-to-cart guard and storefront logic.
 * `triggerSlugs` / `targetSlugs`: explicit DB slugs; category picks expand only when that side’s slug list is empty.
 * Identification of trigger vs target vs fallback is by these slug lists — not by product `isEligibleForCombo`.
 */
export async function GET() {
  try {
    const rules = await loadActiveComboGuardRules();
    return NextResponse.json({ data: { rules } });
  } catch (e) {
    logApiRouteError("GET /api/combo/active-guard-rules", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
