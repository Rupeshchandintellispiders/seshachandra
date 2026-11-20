import { database } from "@/db/mysql";
import { verifyPassword } from "@/lib/password.mjs";
import {
  newRecoveryCode,
  recoveryCodeCount,
  recoveryCodeHash,
} from "@/lib/auth";
import { ApiError, errorResponse, requireAdmin } from "@/lib/server";
export const runtime = "nodejs";
/**
 * Creates a fresh set of recovery codes and returns them once; any older codes
 * stop working. Requires the current password.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const input = (await request.json()) as { current?: unknown };
    if (typeof input?.current !== "string" || input.current.length > 128)
      throw new ApiError(400, "VALIDATION", "Enter your current password.");
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
    const codes = Array.from({ length: recoveryCodeCount }, newRecoveryCode);
    const now = Date.now();
    await database.batch([
      database
        .prepare("DELETE FROM recovery_codes WHERE admin_id=?")
        .bind(user.userId),
      ...codes.map((code) =>
        database
          .prepare(
            "INSERT INTO recovery_codes(code_hash,admin_id,created_at) VALUES(?,?,?)",
          )
          .bind(recoveryCodeHash(code), user.userId, now),
      ),
    ]);
    return Response.json(
      { codes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
