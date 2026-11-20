import { ResetPassword } from "@/components/login";
import { database } from "@/db/mysql";
import { tokenHash } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};
/** Checks the link without using it up; the token is spent on submit. */
async function linkIsValid(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await database
    .prepare(
      "SELECT 1 AS ok FROM password_resets r JOIN admins a ON a.id=r.admin_id WHERE r.token_hash=? AND r.expires_at>? AND a.active=1",
    )
    .bind(tokenHash(token), Date.now())
    .first();
  return !!row;
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) || "";
  return <ResetPassword token={token} valid={await linkIsValid(token)} />;
}
