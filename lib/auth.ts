import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { database, getPool } from "@/db/mysql";
import { hashPassword } from "./password.mjs";
export const sessionCookie = "sc_admin_session";
export const sessionHours = 8;
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await database
    .prepare(
      "SELECT a.id,a.email FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1",
    )
    .bind(tokenHash(token), Date.now())
    .first<{ id: string; email: string }>();
  return row ? { userId: row.id, email: row.email } : null;
}
/**
 * Use at the top of every admin page. Layouts are not re-checked on client
 * navigation, so each page verifies the session itself.
 */
export async function requireAdminPage(path = "/admin") {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login?next=" + encodeURIComponent(path));
  return user;
}
/** Admin pages that must work while signed out. */
export const publicAdminPaths = [
  "/admin/login",
  "/admin/forgot",
  "/admin/reset",
  "/admin/recover",
];
/** Only same-site admin paths are allowed as a post-login destination. */
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(value) &&
    !publicAdminPaths.some((p) => value.startsWith(p))
    ? value
    : "/admin";
}
/**
 * The client address. On Vercel these headers are set by the platform; on
 * other hosts they can be spoofed, which only weakens the per-address limit.
 */
export function clientIp(request: Request) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
type Limit = { key: string; max: number };
/**
 * Attempt limits per 15 minutes. Keying the strict limit on the email+address
 * pair means a stranger cannot lock the owner out by guessing from elsewhere;
 * the wider limits stop broad guessing. Each form has its own counters.
 */
export function attemptLimits(
  kind: "login" | "forgot" | "recover",
  email: string,
  ip: string,
): Limit[] {
  // Login keeps its original, unprefixed keys.
  const p = kind === "login" ? "" : kind + ":";
  const strict = kind === "forgot" ? 3 : 5;
  return [
    { key: hash(p + "pair:" + ip + ":" + email), max: strict },
    { key: hash(p + "ip:" + ip), max: 20 },
    { key: hash(p + "email:" + email), max: kind === "forgot" ? 10 : 50 },
  ];
}
export const loginLimits = (email: string, ip: string) =>
  attemptLimits("login", email, ip);
export const attemptWindowMs = 15 * 60 * 1000;
/** Counts this attempt against every limit; false when any limit is used up. */
export async function allowAttempt(limits: Limit[]) {
  const now = Date.now();
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    let allowed = true;
    for (const { key, max } of limits) {
      await c.execute(
        "INSERT IGNORE INTO login_limits(identifier,attempts,window_start) VALUES(?,0,?)",
        [key, now],
      );
      const [rows] = await c.execute<RowDataPacket[]>(
        "SELECT attempts,window_start FROM login_limits WHERE identifier=? FOR UPDATE",
        [key],
      );
      const expired = now - Number(rows[0].window_start) > attemptWindowMs;
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
export async function clearAttempts(limits: Limit[]) {
  await database
    .prepare(
      `DELETE FROM login_limits WHERE identifier IN (${limits.map(() => "?").join(",")})`,
    )
    .bind(...limits.map((l) => l.key))
    .run();
}
export async function activeSessionCount(adminId: string) {
  const row = await database
    .prepare(
      "SELECT count(*) AS n FROM admin_sessions WHERE admin_id=? AND expires_at>?",
    )
    .bind(adminId, Date.now())
    .first<{ n: number }>();
  return Number(row?.n || 0);
}
export const passwordRules = { min: 12, max: 128 };
export function validNewPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= passwordRules.min &&
    value.length <= passwordRules.max
  );
}
/**
 * Replaces an admin's password after a reset or recovery, and ends every
 * session and outstanding reset link for that admin.
 */
export async function resetPassword(adminId: string, password: string) {
  await database.batch([
    database
      .prepare("UPDATE admins SET password_hash=? WHERE id=?")
      .bind(await hashPassword(password), adminId),
    database.prepare("DELETE FROM admin_sessions WHERE admin_id=?").bind(adminId),
    database.prepare("DELETE FROM password_resets WHERE admin_id=?").bind(adminId),
  ]);
}

export const resetLinkMinutes = 30;
export const recoveryCodeCount = 8;
// No 0/O, 1/I/L: codes are copied by hand.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** A recovery code such as "K7QM-2XHP-9D" (10 characters, about 50 bits). */
export function newRecoveryCode() {
  let raw = "";
  for (let i = 0; i < 10; i++) raw += codeAlphabet[randomInt(codeAlphabet.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
/** Case, spaces and dashes do not matter when a code is typed back in. */
export function recoveryCodeHash(code: string) {
  return hash("recovery:" + code.toUpperCase().replace(/[^0-9A-Z]/g, ""));
}
export async function recoveryCodesLeft(adminId: string) {
  const row = await database
    .prepare("SELECT count(*) AS n FROM recovery_codes WHERE admin_id=?")
    .bind(adminId)
    .first<{ n: number }>();
  return Number(row?.n || 0);
}
