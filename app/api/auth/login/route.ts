import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database, getPool } from "@/db/mysql";
import { verifyPassword, hashPassword } from "@/lib/password.mjs";
import { sessionCookie, tokenHash } from "@/lib/auth";
import { assertOrigin, errorResponse, ApiError } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (Number(request.headers.get("content-length")) > 4096)
      throw new ApiError(413, "VALIDATION", "Request too large.");
    const input = (await request.json()) as {
      email?: unknown;
      password?: unknown;
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
    const key = createHash("sha256").update(email).digest("hex");
    const now = Date.now();
    const c = await getPool().getConnection();
    try {
      await c.beginTransaction();
      await c.execute(
        "INSERT IGNORE INTO login_limits(identifier,attempts,window_start) VALUES(?,0,?)",
        [key, now],
      );
      const [rows] = await c.execute<any[]>(
        "SELECT attempts,window_start FROM login_limits WHERE identifier=? FOR UPDATE",
        [key],
      );
      const row = rows[0];
      const attempts =
        now - Number(row.window_start) > 900000 ? 0 : row.attempts;
      if (attempts >= 5) {
        await c.commit();
        return Response.json(
          {
            error: "Too many attempts. Try again in 15 minutes.",
            code: "RATE_LIMITED",
          },
          { status: 429 },
        );
      }
      await c.execute(
        "UPDATE login_limits SET attempts=?,window_start=? WHERE identifier=?",
        [attempts + 1, attempts ? row.window_start : now, key],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    const user = await database
      .prepare("SELECT id,password_hash FROM admins WHERE email=? AND active=1")
      .bind(email)
      .first<{ id: string; password_hash: string }>();
    const dummy = await hashPassword("unused-password-value");
    const valid = await verifyPassword(
      input.password,
      user?.password_hash || dummy,
    );
    if (!user || !valid)
      return Response.json(
        { error: "Invalid email or password.", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    await database
      .prepare("DELETE FROM login_limits WHERE identifier=?")
      .bind(key)
      .run();
    const token = randomBytes(32).toString("hex");
    await database
      .prepare("DELETE FROM admin_sessions WHERE expires_at<?")
      .bind(now)
      .run();
    await database
      .prepare(
        "INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)",
      )
      .bind(tokenHash(token), user.id, now + 8 * 60 * 60 * 1000)
      .run();
    (await cookies()).set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
