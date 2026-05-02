import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
} from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  if (!secret) {
    return NextResponse.json({ message: "Admin password is not configured (set ADMIN_PASSWORD)" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const password = typeof (body as { password?: unknown }).password === "string"
    ? (body as { password: string }).password
    : "";

  if (password !== secret) {
    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  }

  const token = await createAdminSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  return res;
}
