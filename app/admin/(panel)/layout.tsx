import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: { default: "నిర్వహణ · Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminPage();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
