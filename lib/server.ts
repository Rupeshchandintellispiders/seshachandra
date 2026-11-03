import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAllowedAdmin } from "./validation";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function bindings() {
  if (!env.DB)
    throw new ApiError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database unavailable. Apply migrations and check the DB binding.",
    );
  return env.DB;
}
export async function admin() {
  const user = await getChatGPTUser();
  const vars = env as unknown as Record<string, string>;
  return {
    user,
    allowed: isAllowedAdmin(
      user?.userId ?? null,
      vars.ADMIN_USER_IDS || "",
      import.meta.env.DEV,
    ),
  };
}
export async function requireAdmin(request?: Request) {
  const state = await admin();
  if (!state.allowed)
    throw new ApiError(
      state.user ? 403 : 401,
      "UNAUTHORIZED",
      "Administrator sign-in required.",
    );
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new ApiError(
        403,
        "ORIGIN_REJECTED",
        "Request origin was rejected.",
      );
  }
  return state.user!;
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof Error && /UNIQUE constraint/.test(error.message))
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
