import { Account } from "@/components/admin/account";
import {
  activeSessionCount,
  recoveryCodesLeft,
  requireAdminPage,
} from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
export const metadata = { title: "Account" };
export default async function Page() {
  const user = await requireAdminPage("/admin/account");
  const [sessions, codesLeft] = await Promise.all([
    activeSessionCount(user.userId),
    recoveryCodesLeft(user.userId),
  ]);
  return (
    <Account
      email={user.email}
      sessions={Math.max(1, sessions)}
      codesLeft={codesLeft}
      emailAvailable={mailConfigured()}
    />
  );
}
