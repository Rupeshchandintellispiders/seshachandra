import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { database } from "@/db/mysql";
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
/** Only same-site admin paths are allowed as a post-login destination. */
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(value) &&
    !value.startsWith("/admin/login")
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
/**
 * Login attempt limits per 15 minutes. Keying the strict limit on the
 * email+address pair means a stranger cannot lock the owner out by guessing
 * from elsewhere; the wider limits stop broad guessing.
 */
export function loginLimits(email: string, ip: string) {
  return [
    { key: hash("pair:" + ip + ":" + email), max: 5 },
    { key: hash("ip:" + ip), max: 20 },
    { key: hash("email:" + email), max: 50 },
  ];
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
