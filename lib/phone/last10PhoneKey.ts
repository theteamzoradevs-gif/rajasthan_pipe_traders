/**
 * Normalizes a phone string to the last 10 digits for matching
 * (e.g. 919971082215 → 9971082215, 997-108-2215 → 9971082215).
 */
export function last10PhoneKey(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}
