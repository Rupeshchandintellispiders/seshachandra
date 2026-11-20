import { database } from "@/db/mysql";
import {
  allowAttempt,
  attemptLimits,
  clearAttempts,
  clientIp,
  passwordRules,
  recoveryCodeHash,
  recoveryCodesLeft,
  resetPassword,
  validNewPassword,
} from "@/lib/auth";
import { ApiError, assertOrigin, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
/** Sets a new password with the account email and one unused recovery code. */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      email?: unknown;
      code?: unknown;
      password?: unknown;
    };
    if (
      typeof input?.email !== "string" ||
      input.email.length > 254 ||
      typeof input.code !== "string" ||
      input.code.length > 40
    )
      throw new ApiError(
        400,
        "VALIDATION",
        "Enter your email and a recovery code.",
      );
    if (!validNewPassword(input.password))
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        `Use a new password of ${passwordRules.min} to ${passwordRules.max} characters.`,
      );
    const email = input.email.trim().toLowerCase();
    const limits = attemptLimits("recover", email, clientIp(request));
    if (!(await allowAttempt(limits)))
      return Response.json(
        {
          error: "Too many attempts. Try again in 15 minutes.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    const user = await database
      .prepare("SELECT id FROM admins WHERE email=? AND active=1")
      .bind(email)
      .first<{ id: string }>();
    // Each code works once: deleting it is the check.
    const used = user
      ? await database
          .prepare("DELETE FROM recovery_codes WHERE code_hash=? AND admin_id=?")
          .bind(recoveryCodeHash(input.code), user.id)
          .run()
      : null;
    if (!user || !used?.meta.changes)
      throw new ApiError(
        400,
        "INVALID_CODE",
        "The email or recovery code is incorrect.",
      );
    await resetPassword(user.id, input.password);
    await clearAttempts(limits);
    return Response.json({
      ok: true,
      codesLeft: await recoveryCodesLeft(user.id),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
