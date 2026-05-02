import { v2 as cloudinary } from "cloudinary";

let configured = false;

function applyCloudinaryUrl(url: string): boolean {
  const m = url.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/]+)$/);
  if (!m) return false;
  const [, api_key, api_secret, cloud_name] = m;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return true;
}

function tryConfigure(): boolean {
  if (configured) return true;
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url && applyCloudinaryUrl(url)) {
    configured = true;
    return true;
  }
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloud_name && api_key && api_secret) {
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    configured = true;
    return true;
  }
  return false;
}

export function isCloudinaryConfigured(): boolean {
  return tryConfigure();
}

export function getCloudinaryUploadPrefix(): string {
  return process.env.CLOUDINARY_UPLOAD_PREFIX?.trim() || "rpt";
}

function buildFolder(
  kind: string,
  productId?: string | null,
  categoryId?: string | null
): string {
  const base = getCloudinaryUploadPrefix();
  if (kind === "banner") {
    return `${base}/banner`;
  }
  const k = kind === "category" ? "category" : "product";
  if (k === "product" && productId?.trim()) {
    return `${base}/product/${productId.trim()}`;
  }
  if (k === "category" && categoryId?.trim()) {
    return `${base}/category/${categoryId.trim()}`;
  }
  return `${base}/${k}`;
}

export async function uploadImageFromBuffer(input: {
  buffer: Buffer;
  mime: string;
  kind: string;
  productId?: string | null;
  categoryId?: string | null;
}): Promise<{ secure_url: string; public_id: string }> {
  if (!tryConfigure()) throw new Error("Cloudinary is not configured");
  const folder = buildFolder(input.kind, input.productId, input.categoryId);
  const dataUri = `data:${input.mime || "application/octet-stream"};base64,${input.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    overwrite: false,
  });
  if (!result?.secure_url || !result?.public_id) {
    throw new Error("Cloudinary upload returned an unexpected response");
  }
  return { secure_url: result.secure_url, public_id: result.public_id };
}

export async function replaceImageByPublicId(input: {
  buffer: Buffer;
  mime: string;
  publicId: string;
}): Promise<{ secure_url: string; public_id: string }> {
  if (!tryConfigure()) throw new Error("Cloudinary is not configured");
  const dataUri = `data:${input.mime || "application/octet-stream"};base64,${input.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: input.publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
  });
  if (!result?.secure_url || !result?.public_id) {
    throw new Error("Cloudinary replace returned an unexpected response");
  }
  return { secure_url: result.secure_url, public_id: result.public_id };
}

export async function destroyImage(publicId: string): Promise<void> {
  if (!tryConfigure()) throw new Error("Cloudinary is not configured");
  const res = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  if (res.result !== "ok" && res.result !== "not found") {
    throw new Error(typeof res.result === "string" ? res.result : "Cloudinary delete failed");
  }
}

export async function listImages(input: {
  limit: number;
  cursor?: string;
  kindPrefix?: string | null;
}): Promise<{ items: Record<string, unknown>[]; nextCursor?: string }> {
  if (!tryConfigure()) throw new Error("Cloudinary is not configured");
  const base = getCloudinaryUploadPrefix();
  let prefix = `${base}/`;
  if (input.kindPrefix === "product") prefix = `${base}/product/`;
  else if (input.kindPrefix === "category") prefix = `${base}/category/`;
  else if (input.kindPrefix === "banner") prefix = `${base}/banner/`;

  const limit = Math.min(100, Math.max(1, input.limit));
  const result = await cloudinary.api.resources({
    type: "upload",
    prefix,
    max_results: limit,
    ...(input.cursor ? { next_cursor: input.cursor } : {}),
  });

  const resources = (result.resources ?? []) as Array<{
    public_id: string;
    secure_url: string;
    url: string;
    format: string;
    bytes: number;
    created_at: string;
  }>;
  const items = resources.map((r) => ({
    _id: r.public_id,
    public_id: r.public_id,
    secure_url: r.secure_url,
    url: r.url,
    kind: "image",
    format: r.format,
    bytes: r.bytes,
    created_at: r.created_at,
  }));

  return {
    items,
    nextCursor: result.next_cursor,
  };
}

export async function getImageResource(publicId: string): Promise<Record<string, unknown>> {
  if (!tryConfigure()) throw new Error("Cloudinary is not configured");
  const r = await cloudinary.api.resource(publicId, { resource_type: "image" });
  return {
    _id: r.public_id,
    public_id: r.public_id,
    secure_url: r.secure_url,
    url: r.url,
    kind: "image",
    format: r.format,
    bytes: r.bytes,
    created_at: r.created_at,
  };
}
