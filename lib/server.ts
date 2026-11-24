import "./load-env";
import { database } from "@/db/mysql";
import { currentAdmin } from "./auth";

import { ApiError } from "./api-error";
export { ApiError };
export function bindings() {
  return database;
}
export async function admin() {
  const user = await currentAdmin();
  return { user, allowed: !!user };
}
/**
 * Blocks cross-site form posts: the browser's Origin header must be this site.
 * Accepted: SITE_URL, and the address the request itself arrived at (so
 * preview URLs, custom domains and localhost/127.0.0.1 work). Other sites
 * cannot forge either, because browsers set Origin and Host themselves.
 */
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(request).has(origin))
    throw new ApiError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
}
function allowedOrigins(request: Request) {
  const allowed = new Set<string>();
  const add = (value: string | undefined | null) => {
    try {
      if (value) allowed.add(new URL(value).origin);
    } catch {
      // An invalid SITE_URL simply adds nothing.
    }
  };
  add(process.env.SITE_URL);
  add(request.url);
  // Behind a proxy (e.g. Vercel) the public address arrives in these headers.
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (host) add(`${proto || new URL(request.url).protocol.replace(":", "")}://${host.split(",")[0].trim()}`);
  return allowed;
}
export async function requireAdmin(request?: Request) {
  const state = await admin();
  if (!state.allowed)
    throw new ApiError(
      state.user ? 403 : 401,
      "UNAUTHORIZED",
      "Administrator sign-in required.",
    );
  if (request && !["GET", "HEAD"].includes(request.method))
    assertOrigin(request);
  return state.user!;
}
export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Invalid JSON request.", code: "VALIDATION" },
      { status: 400 },
    );
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (
    error instanceof Error &&
    /UNIQUE constraint|Duplicate entry/.test(error.message)
  )
    return Response.json(
      {
        error: "This slug or YouTube video already exists.",
        code: "DUPLICATE",
      },
      { status: 409 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.message : "Unknown failure",
  );
  return Response.json(
    {
      error:
        "The request could not be completed. Check database setup and try again.",
      code: "REQUEST_FAILED",
    },
    { status: 500 },
  );
}
export function decodeWork(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    description: row.description,
    body: row.body,
    tags: JSON.parse(row.tags as string),
    categoryId: row.category_id,
    status: row.status,
    featured: !!row.featured,
    youtubeId: row.youtube_id,
    publication: row.publication,
    publicationDate: row.publication_date,
    attribution: row.attribution,
    externalUrl: row.external_url,
    coverId: row.cover_id,
    attachmentIds: JSON.parse(row.attachment_ids as string),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
