import { requireAdmin, errorResponse, ApiError, bindings } from "@/lib/server";
import { stagedBytes, removeStaged, storage } from "@/lib/storage";
import { validFile } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const value = (await request.json()) as { id?: unknown };
    const id = value?.id;
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
      throw new ApiError(400, "INVALID_FILE", "Invalid upload.");
    const db = bindings();
    const intent = await db
      .prepare(
        "SELECT * FROM upload_intents WHERE id=? AND admin_id=? AND expires_at>?",
      )
      .bind(id, user.userId, Date.now())
      .first<{ name: string; mime: string; size: number }>();
    if (!intent)
      throw new ApiError(
        400,
        "INVALID_FILE",
        "Upload expired or already completed.",
      );
    const claimed = await db
      .prepare("DELETE FROM upload_intents WHERE id=? AND admin_id=?")
      .bind(id, user.userId)
      .run();
    if (!claimed.meta.changes)
      throw new ApiError(409, "DUPLICATE", "Upload already completed.");
    try {
      let bytes: Uint8Array;
      try {
        bytes = await stagedBytes(id, intent.size);
      } catch {
        throw new ApiError(
          400,
          "INVALID_FILE",
          "The uploaded file is missing or has an invalid size.",
        );
      }
      if (!validFile(bytes, intent.mime))
        throw new ApiError(
          400,
          "INVALID_FILE",
          "File contents do not match the selected type.",
        );
      await storage.put(id, bytes, {
        httpMetadata: { contentType: intent.mime },
      });
      try {
        await db
          .prepare(
            "INSERT INTO uploads(id,name,mime,size,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            id,
            intent.name,
            intent.mime,
            intent.size,
            new Date().toISOString(),
          )
          .run();
      } catch (e) {
        await storage.delete(id);
        throw e;
      }
      return Response.json({ id, name: intent.name }, { status: 201 });
    } finally {
      await removeStaged(id).catch(() => {});
    }
  } catch (e) {
    return errorResponse(e);
  }
}
