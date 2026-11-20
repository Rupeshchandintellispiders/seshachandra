import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence for the admin area: visitors without a session
 * cookie are sent to the sign-in page before anything renders. The cookie is
 * only checked for shape here; every admin page and API call still verifies
 * the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("sc_admin_session")?.value;
  const signedIn = !!token && /^[a-f0-9]{64}$/.test(token);
  if (!signedIn && pathname !== "/admin/login") {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname + search);
    return withAdminHeaders(NextResponse.redirect(login));
  }
  return withAdminHeaders(NextResponse.next());
}

function withAdminHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
