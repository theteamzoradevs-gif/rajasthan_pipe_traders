import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function isPublicAdminApi(pathname: string): boolean {
  return pathname === "/api/admin/login" || pathname === "/api/admin/logout";
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secret = process.env.ADMIN_PASSWORD ?? "";

  if (!secret) {
    if (pathname.startsWith("/api/admin") && !isPublicAdminApi(pathname)) {
      return NextResponse.json({ message: "Admin password is not configured (set ADMIN_PASSWORD)" }, { status: 503 });
    }
    if (pathname.startsWith("/admin") && !isAdminLoginPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (isAdminLoginPath(pathname) || isPublicAdminApi(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "";
    const ok = await verifyAdminSessionToken(secret, token);
    if (!ok) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
