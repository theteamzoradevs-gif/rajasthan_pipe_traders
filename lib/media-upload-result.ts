/** Parse upload / media JSON from various backend shapes (incl. raw Cloudinary fields). */
export function extractUploadResult(json: unknown): { url: string; mediaId?: string } {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  let node: unknown = root.data !== undefined ? root.data : root;
  if (node && typeof node === "object" && "data" in node) {
    const inner = (node as Record<string, unknown>).data;
    if (inner !== undefined) node = inner;
  }
  const o = node && typeof node === "object" ? (node as Record<string, unknown>) : {};
  const url =
    (typeof o.secure_url === "string" && o.secure_url) ||
    (typeof o.secureUrl === "string" && o.secureUrl) ||
    (typeof o.url === "string" && o.url) ||
    (typeof o.cloudinaryUrl === "string" && o.cloudinaryUrl) ||
    (typeof o.src === "string" && o.src) ||
    "";
  let mediaId: string | undefined =
    (typeof o._id === "string" && o._id) || (typeof o.id === "string" && o.id) || undefined;
  if (!mediaId && typeof o.mediaId === "string") mediaId = o.mediaId;
  if (!mediaId && typeof o.public_id === "string") mediaId = o.public_id;
  if (!url) throw new Error("Upload succeeded but no image URL was found in the response");
  return { url, mediaId };
}
