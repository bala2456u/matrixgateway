import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessEnabled, accessToken } from "@/lib/access";

const OPEN_PATHS = ["/access", "/api/access", "/api/health"];

export function proxy(request: NextRequest) {
  if (!accessEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (request.cookies.get(ACCESS_COOKIE)?.value === accessToken()) {
    return NextResponse.next();
  }

  // API callers get a clean 401 rather than an HTML redirect
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { message: "This deployment is private" } }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
