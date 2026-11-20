import { cookies } from "next/headers";
import { database } from "@/db/mysql";
import { hashPassword, verifyPassword } from "@/lib/password.mjs";
import { passwordRules, sessionCookie, tokenHash } from "@/lib/auth";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
export const runtime = "nodejs";
/**
 * Changes the signed-in admin's password. Requires the current password and
 * signs out every other device; this browser stays signed in.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 4096)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      current?: unknown;
      next?: unknown;
    };
    if (
      typeof input?.current !== "string" ||
      typeof input.next !== "string" ||
      input.current.length > passwordRules.max
    )
      throw new ApiError(400, "VALIDATION", "Enter both passwords.");
    if (
      input.next.length < passwordRules.min ||
      input.next.length > passwordRules.max
    )
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        `Use a new password of ${passwordRules.min} to ${passwordRules.max} characters.`,
      );
    const row = await database
      .prepare("SELECT password_hash FROM admins WHERE id=? AND active=1")
      .bind(user.userId)
      .first<{ password_hash: string }>();
    if (!row || !(await verifyPassword(input.current, row.password_hash)))
      throw new ApiError(
        400,
        "WRONG_PASSWORD",
        "The current password is incorrect.",
      );
    if (await verifyPassword(input.next, row.password_hash))
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        "Choose a password different from the current one.",
      );
    const token = (await cookies()).get(sessionCookie)?.value || "";
    await database.batch([
      database
        .prepare("UPDATE admins SET password_hash=? WHERE id=?")
        .bind(await hashPassword(input.next), user.userId),
      database
        .prepare("DELETE FROM admin_sessions WHERE admin_id=? AND token_hash<>?")
        .bind(user.userId, tokenHash(token)),
    ]);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
