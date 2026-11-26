import { database } from "@/db/mysql";
import { logoMimes, maxLogoBytes } from "@/lib/site-logo";
import { validFile } from "@/lib/validation";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
export const runtime = "nodejs";
const invalid = () =>
  new ApiError(
    400,
    "LOGO_INVALID",
    "Choose a PNG, JPEG or WebP image up to 1 MB.",
  );
/** Uploads or replaces the site logo (multipart form, field "file"). */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > maxLogoBytes + 64 * 1024)
      throw invalid();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > maxLogoBytes ||
      !logoMimes.includes(file.type)
    )
      throw invalid();
    const bytes = new Uint8Array(await file.arrayBuffer());
    // The file's own bytes must match its claimed type (no renamed HTML/SVG).
    if (!validFile(bytes, file.type)) throw invalid();
    const now = Date.now();
    await database
      .prepare(
        "INSERT INTO site_logo(id,mime,data,updated_at) VALUES('site',?,?,?) ON DUPLICATE KEY UPDATE mime=VALUES(mime),data=VALUES(data),updated_at=VALUES(updated_at)",
      )
      .bind(file.type, Buffer.from(bytes), now)
      .run();
    return Response.json({ ok: true, url: "/site-logo?v=" + now });
  } catch (e) {
    return errorResponse(e);
  }
}
/** Removes the logo; the site falls back to the text emblem. */
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    await database.prepare("DELETE FROM site_logo WHERE id='site'").run();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
