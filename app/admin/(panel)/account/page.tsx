import { Account } from "@/components/admin/account";
import { activeSessionCount, requireAdminPage } from "@/lib/auth";
export const metadata = { title: "Account" };
export default async function Page() {
  const user = await requireAdminPage("/admin/account");
  return (
    <Account
      email={user.email}
      sessions={Math.max(1, await activeSessionCount(user.userId))}
    />
  );
}
