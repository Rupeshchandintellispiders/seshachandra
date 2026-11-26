import { database } from "@/db/mysql";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Serves the uploaded site logo. Versioned addresses are cached for good. */
export async function GET(request: Request) {
  const row = await database
    .prepare("SELECT mime,data,updated_at FROM site_logo WHERE id='site'")
    .first<{ mime: string; data: Buffer; updated_at: number }>();
  if (!row) return new Response("No logo", { status: 404 });
  const version = new URL(request.url).searchParams.get("v");
  const current = version === String(Number(row.updated_at));
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": current
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
