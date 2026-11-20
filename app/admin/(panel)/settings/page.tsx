import { SiteSettings } from "@/components/admin/site-settings";
import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/content";
export const metadata = { title: "About & links" };
export default async function Page() {
  await requireAdminPage("/admin/settings");
  return <SiteSettings initial={await getSettings()} />;
}
