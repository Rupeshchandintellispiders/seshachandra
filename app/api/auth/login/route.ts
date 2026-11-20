import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { database, getPool } from "@/db/mysql";
import { verifyPassword, hashPassword } from "@/lib/password.mjs";
import {
  sessionCookie,
  sessionHours,
  tokenHash,
  clientIp,
  loginLimits,
  safeNext,
} from "@/lib/auth";
import { assertOrigin, errorResponse, ApiError } from "@/lib/server";
export const runtime = "nodejs";
const windowMs = 15 * 60 * 1000;
// Compared against when the email is unknown, so timing does not reveal accounts.
const dummyHash = hashPassword("unused-password-value");
/** Counts this attempt against every limit; false when any limit is used up. */
async function allowAttempt(keys: { key: string; max: number }[]) {
  const now = Date.now();
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    let allowed = true;
    for (const { key, max } of keys) {
      await c.execute(
        "INSERT IGNORE INTO login_limits(identifier,attempts,window_start) VALUES(?,0,?)",
        [key, now],
      );
      const [rows] = await c.execute<RowDataPacket[]>(
        "SELECT attempts,window_start FROM login_limits WHERE identifier=? FOR UPDATE",
        [key],
      );
      const expired = now - Number(rows[0].window_start) > windowMs;
      const attempts = expired ? 0 : Number(rows[0].attempts);
      if (attempts >= max) allowed = false;
      await c.execute(
        "UPDATE login_limits SET attempts=?,window_start=? WHERE identifier=?",
        [attempts + 1, expired ? now : rows[0].window_start, key],
      );
    }
    await c.commit();
    return allowed;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
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
    await database
      .prepare(
        `DELETE FROM login_limits WHERE identifier IN (${limits.map(() => "?").join(",")})`,
      )
      .bind(...limits.map((l) => l.key))
      .run();
    const now = Date.now();
    await database
      .prepare("DELETE FROM admin_sessions WHERE expires_at<?")
      .bind(now)
      .run();
    await database
      .prepare("DELETE FROM login_limits WHERE window_start<?")
      .bind(now - windowMs)
      .run();
    const token = randomBytes(32).toString("hex");
    await database
      .prepare(
        "INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)",
      )
      .bind(tokenHash(token), user.id, now + sessionHours * 60 * 60 * 1000)
      .run();
    (await cookies()).set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: sessionHours * 60 * 60,
    });
    return Response.json({ ok: true, next: safeNext(input.next) });
  } catch (e) {
    return errorResponse(e);
  }
}
