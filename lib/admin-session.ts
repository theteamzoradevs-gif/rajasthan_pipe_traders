/**
 * Signed admin session cookie (HMAC-SHA256). Works in Edge middleware and Node route handlers.
 */

export const ADMIN_SESSION_COOKIE = "rpt_admin_session";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return diff === 0;
}

export async function createAdminSessionToken(secret: string): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const payload = JSON.stringify({ exp });
  const payloadB64 = utf8ToBase64Url(payload);
  const sig = await hmacSha256Hex(secret, payload);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminSessionToken(secret: string, token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigHex] = parts;
  if (!payloadB64 || !sigHex) return false;
  let payload: string;
  try {
    payload = base64UrlToUtf8(payloadB64);
  } catch {
    return false;
  }
  const expectedSig = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqualHex(expectedSig, sigHex)) return false;
  let data: { exp?: number };
  try {
    data = JSON.parse(payload) as { exp?: number };
  } catch {
    return false;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) return false;
  return true;
}

export function adminSessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(TTL_MS / 1000),
  };
}
