import { database } from "@/db/mysql";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
export const runtime = "nodejs";
/** Cancels a pending invite; its link stops working immediately. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(id))
      throw new ApiError(404, "NOT_FOUND", "Invite not found.");
    const result = await database
      .prepare("DELETE FROM admin_invites WHERE id=?")
      .bind(id)
      .run();
    if (!result.meta.changes)
      throw new ApiError(404, "NOT_FOUND", "Invite not found.");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
