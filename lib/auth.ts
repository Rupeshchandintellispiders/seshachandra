import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { database } from "@/db/mysql";
export const sessionCookie = "sc_admin_session";
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
