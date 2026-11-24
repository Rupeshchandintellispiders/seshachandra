import { Account } from "@/components/admin/account";
import {
  activeSessionCount,
  pendingInvites,
  recoveryCodesLeft,
  requireAdminPage,
} from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
export const metadata = { title: "Account" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await requireAdminPage("/admin/account");
  const [sessions, codesLeft, invites] = await Promise.all([
    activeSessionCount(user.userId),
    recoveryCodesLeft(user.userId),
    pendingInvites(),
  ]);
  return (
    <Account
      email={user.email}
      sessions={Math.max(1, sessions)}
      codesLeft={codesLeft}
      emailAvailable={mailConfigured()}
      invites={invites}
      welcome={(await searchParams).welcome === "1"}
    />
  );
}
