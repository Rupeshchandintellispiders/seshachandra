import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page:
 * - Sets a per-request Content-Security-Policy. Next.js reads the nonce from
 *   the request header and attaches it to its own scripts, so only scripts
 *   this app sends can run.
 * - Guards the admin area: visitors without a session cookie are sent to the
 *   sign-in page before anything renders. The cookie is only checked for shape
 *   here; every admin page and API call still verifies it against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(nonce);
  if (admin && !publicAdminPaths.includes(pathname) && !hasSessionCookie(request)) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname + search);
    return secure(NextResponse.redirect(login), csp, true);
  }
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  return secure(NextResponse.next({ request: { headers } }), csp, admin);
}

// Signed-out pages: sign-in and password recovery. Keep in step with
// publicAdminPaths in lib/auth.ts (the proxy cannot import database code).
const publicAdminPaths = [
  "/admin/login",
  "/admin/forgot",
  "/admin/reset",
  "/admin/recover",
];

function hasSessionCookie(request: NextRequest) {
  const token = request.cookies.get("sc_admin_session")?.value;
  return !!token && /^[a-f0-9]{64}$/.test(token);
}

/** Origin of the private upload bucket; browsers upload to and read from it. */
function storageOrigin() {
  try {
    return process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : "";
  } catch {
    return "";
  }
}

function policy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  const storage = storageOrigin();
  return [
    "default-src 'self'",
    // React needs eval only for development error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (e.g. reader text size) cannot carry a nonce.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https://i.ytimg.com ${storage}`.trim(),
    "frame-src https://www.youtube-nocookie.com",
    ["connect-src 'self'", storage, dev ? "ws: wss:" : ""].filter(Boolean).join(" "),
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function secure(response: NextResponse, csp: string, admin: boolean) {
  response.headers.set("Content-Security-Policy", csp);
  if (admin) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "same-origin");
  }
  return response;
}

export const config = {
  // Every page; not API routes, build assets or the favicon.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.svg).*)"],
};
