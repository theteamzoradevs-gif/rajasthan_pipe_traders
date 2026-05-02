/** Human-readable timestamps for admin (e.g. "Apr 23, 2026, 11:45 PM"). */
export function formatAdminDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
