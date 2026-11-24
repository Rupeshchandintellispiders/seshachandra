import { cookies } from "next/headers";
import { database } from "@/db/mysql";
import { verifyPassword } from "@/lib/password.mjs";
import {
  normalEmail,
  sessionCookie,
  tokenHash,
  validEmail,
} from "@/lib/auth";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
export const runtime = "nodejs";
/**
 * Changes the signed-in admin's email. Requires the current password, refuses
 * an email another admin uses, and signs out every other device.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      email?: unknown;
      current?: unknown;
    };
    if (!validEmail(input?.email))
      throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
    if (typeof input.current !== "string" || input.current.length > 128)
      throw new ApiError(400, "VALIDATION", "Enter your current password.");
    const email = normalEmail(input.email);
    const row = await database
      .prepare("SELECT email,password_hash FROM admins WHERE id=? AND active=1")
      .bind(user.userId)
      .first<{ email: string; password_hash: string }>();
    if (!row || !(await verifyPassword(input.current, row.password_hash)))
      throw new ApiError(
        400,
        "WRONG_PASSWORD",
        "The current password is incorrect.",
      );
    if (email === row.email) return Response.json({ ok: true, email });
    const taken = await database
      .prepare("SELECT id FROM admins WHERE email=? AND id<>?")
      .bind(email, user.userId)
      .first();
    if (taken)
      throw new ApiError(
        409,
        "EMAIL_TAKEN",
        "Another admin already uses this email.",
      );
    const token = (await cookies()).get(sessionCookie)?.value || "";
    await database.batch([
      database
        .prepare("UPDATE admins SET email=? WHERE id=?")
        .bind(email, user.userId),
      database
        .prepare("DELETE FROM admin_sessions WHERE admin_id=? AND token_hash<>?")
        .bind(user.userId, tokenHash(token)),
      database
        .prepare("DELETE FROM password_resets WHERE admin_id=?")
        .bind(user.userId),
    ]);
    return Response.json({ ok: true, email });
  } catch (e) {
    return errorResponse(e);
  }
}
