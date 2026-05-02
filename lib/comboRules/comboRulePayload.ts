/** Valid 24-char hex Mongo ObjectId strings (no mongoose import — safe for client bundles). */
export function parseObjectIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const x of input) {
    const s = String(x).trim();
    if (/^[a-f\d]{24}$/i.test(s)) out.push(s);
  }
  return [...new Set(out)];
}

/** Parse slug lists from comma-separated strings or string arrays (admin/API). */
export function parseSlugList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseMinTriggerBags(input: unknown, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  if (typeof input === "string" && input.trim() !== "") {
    const n = Number(input);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return fallback;
}

/** True when the client sent a value that should be parsed (omit field when false). */
export function hasComboPriceInclGstInput(input: unknown): boolean {
  if (input === undefined || input === null) return false;
  if (input === "") return false;
  if (typeof input === "string" && input.trim() === "") return false;
  return true;
}

export function parseComboPriceInclGst(input: unknown): number | null {
  if (!hasComboPriceInclGstInput(input)) return null;
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) return input;
  if (typeof input === "string" && input.trim() !== "") {
    const n = Number(input);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}
