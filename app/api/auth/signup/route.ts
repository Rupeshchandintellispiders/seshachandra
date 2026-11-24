import { database } from "@/db/mysql";
import { hashPassword } from "@/lib/password.mjs";
import {
  allowAttempt,
  attemptLimits,
  clientIp,
  findInvite,
  passwordRules,
  startSession,
  tokenHash,
  validNewPassword,
} from "@/lib/auth";
import { ApiError, assertOrigin, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
const invalid = () =>
  new ApiError(
    400,
    "INVALID_INVITE",
    "This invite link is invalid, used or expired. Ask for a new one.",
  );
/**
 * Creates an admin from a one-time invite link and signs them in. There is no
 * open registration: without a valid invite nothing is created.
 */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      token?: unknown;
      password?: unknown;
    };
    if (typeof input?.token !== "string") throw invalid();
    if (
      !(await allowAttempt(
        attemptLimits("signup", tokenHash(input.token), clientIp(request)),
      ))
    )
      return Response.json(
        {
          error: "Too many attempts. Try again in 15 minutes.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    if (!validNewPassword(input.password))
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        `Use a password of ${passwordRules.min} to ${passwordRules.max} characters.`,
      );
    const invite = await findInvite(input.token);
    if (!invite) throw invalid();
    // Claim the invite first so the link cannot be used twice.
    const claimed = await database
      .prepare("DELETE FROM admin_invites WHERE id=?")
      .bind(invite.id)
      .run();
    if (!claimed.meta.changes) throw invalid();
    if (
      await database
        .prepare("SELECT id FROM admins WHERE email=?")
        .bind(invite.email)
        .first()
    )
      throw new ApiError(
        409,
        "EMAIL_TAKEN",
        "This email already belongs to an admin. Sign in instead.",
      );
    const id = crypto.randomUUID();
    await database
      .prepare("INSERT INTO admins(id,email,password_hash) VALUES(?,?,?)")
      .bind(id, invite.email, await hashPassword(input.password))
      .run();
    await startSession(id);
    return Response.json({ ok: true, email: invite.email }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
