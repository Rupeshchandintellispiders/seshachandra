import { requireAdmin, errorResponse, ApiError, bindings } from "@/lib/server";
import {
  cloudStorage,
  presignUpload,
  allowedMimes,
  maxFileSize,
} from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (!cloudStorage()) return Response.json({ local: true });
    const v = (await request.json()) as {
      name: string;
      mime: string;
      size: number;
    };
    if (
      !v ||
      typeof v.name !== "string" ||
      v.name.length > 255 ||
      !allowedMimes.includes(v.mime) ||
      !Number.isSafeInteger(v.size) ||
      v.size <= 0 ||
      v.size > maxFileSize
    )
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Choose a PDF, JPEG, PNG or WebP up to 10 MB.",
      );
    const id = crypto.randomUUID();
    const name =
      v.name.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 150) || "attachment";
    const url = await presignUpload(id, v.mime);
    // Abandoned uploads leave intents behind; clear any that have expired.
    // Their staged objects are removed by the bucket's staging/ lifecycle rule.
    await bindings()
      .prepare("DELETE FROM upload_intents WHERE expires_at<?")
      .bind(Date.now())
      .run();
    await bindings()
      .prepare(
        "INSERT INTO upload_intents(id,admin_id,name,mime,size,expires_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, user.userId, name, v.mime, v.size, Date.now() + 5 * 60 * 1000)
      .run();
    return Response.json(
      { id, url, local: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
