import { database } from "@/db/mysql";
import { verifyPassword, hashPassword } from "@/lib/password.mjs";
import {
  startSession,
  clientIp,
  loginLimits,
  safeNext,
  allowAttempt,
  clearAttempts,
  attemptWindowMs,
} from "@/lib/auth";
import { assertOrigin, errorResponse, ApiError } from "@/lib/server";
export const runtime = "nodejs";
// Compared against when the email is unknown, so timing does not reveal accounts.
const dummyHash = hashPassword("unused-password-value");
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 4096)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      email?: unknown;
      password?: unknown;
      next?: unknown;
    };
    if (
      !input ||
      typeof input.email !== "string" ||
      typeof input.password !== "string" ||
      input.password.length > 128 ||
      input.email.length > 254
    )
      throw new ApiError(400, "VALIDATION", "Enter your email and password.");
    const email = input.email.trim().toLowerCase();
    const limits = loginLimits(email, clientIp(request));
    if (!(await allowAttempt(limits)))
      return Response.json(
        {
          error: "Too many attempts. Try again in 15 minutes.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    const user = await database
      .prepare("SELECT id,password_hash FROM admins WHERE email=? AND active=1")
      .bind(email)
      .first<{ id: string; password_hash: string }>();
    const valid = await verifyPassword(
      input.password,
      user?.password_hash || (await dummyHash),
    );
    if (!user || !valid)
      return Response.json(
        { error: "Invalid email or password.", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    // A correct password clears this person's counters.
    await clearAttempts(limits);
    const now = Date.now();
    await database
      .prepare("DELETE FROM admin_sessions WHERE expires_at<?")
      .bind(now)
      .run();
    await database
      .prepare("DELETE FROM login_limits WHERE window_start<?")
      .bind(now - attemptWindowMs)
      .run();
    await startSession(user.id);
    return Response.json({ ok: true, next: safeNext(input.next) });
  } catch (e) {
    return errorResponse(e);
  }
}
