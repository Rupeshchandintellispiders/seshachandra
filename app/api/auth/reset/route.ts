import { database } from "@/db/mysql";
import {
  passwordRules,
  resetPassword,
  tokenHash,
  validNewPassword,
} from "@/lib/auth";
import { ApiError, assertOrigin, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
const invalid = () =>
  new ApiError(400, "INVALID_RESET", "This reset link is invalid or has expired.");
/** Sets a new password using a reset link's token; the link then stops working. */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 2048)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      token?: unknown;
      password?: unknown;
    };
    if (typeof input?.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token))
      throw invalid();
    if (!validNewPassword(input.password))
      throw new ApiError(
        400,
        "WEAK_PASSWORD",
        `Use a new password of ${passwordRules.min} to ${passwordRules.max} characters.`,
      );
    const hash = tokenHash(input.token);
    const row = await database
      .prepare(
        "SELECT r.admin_id FROM password_resets r JOIN admins a ON a.id=r.admin_id WHERE r.token_hash=? AND r.expires_at>? AND a.active=1",
      )
      .bind(hash, Date.now())
      .first<{ admin_id: string }>();
    if (!row) throw invalid();
    // Claim the token first so two submissions cannot both use it.
    const claimed = await database
      .prepare("DELETE FROM password_resets WHERE token_hash=?")
      .bind(hash)
      .run();
    if (!claimed.meta.changes) throw invalid();
    await resetPassword(row.admin_id, input.password);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
