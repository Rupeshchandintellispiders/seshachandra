import { Dashboard } from "@/components/admin/dashboard";
import { requireAdminPage } from "@/lib/auth";
import { listCategories, listWorks, workCounts } from "@/lib/content";
// The layout's title template only applies to nested pages, so set it in full.
export const metadata = { title: { absolute: "Dashboard · Admin" } };
export default async function Page() {
  await requireAdminPage("/admin");
  const [counts, recent, categories] = await Promise.all([
    workCounts(),
    listWorks({ admin: true, sort: "updated" }),
    listCategories(),
  ]);
  return (
    <Dashboard
      counts={counts}
      recent={recent.items.slice(0, 8)}
      categories={categories.length}
    />
  );
}
