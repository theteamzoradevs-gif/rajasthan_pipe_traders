const PHONE_KEY = "rpt_lead_phone";

const PHONE_RE = /^\d{10}$/;

export function getStoredLeadPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(PHONE_KEY);
    if (!v) return null;
    const t = v.trim().replace(/\D/g, "");
    return PHONE_RE.test(t) ? t : null;
  } catch {
    return null;
  }
}

export function setStoredLeadPhone(phone: string): void {
  if (typeof window === "undefined") return;
  const t = phone.replace(/\D/g, "");
  if (!PHONE_RE.test(t)) return;
  try {
    localStorage.setItem(PHONE_KEY, t);
  } catch {
    /* ignore */
  }
}

export function isValidLeadPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\D/g, ""));
}
