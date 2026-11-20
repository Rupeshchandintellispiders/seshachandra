import { Categories } from "@/components/admin/categories";
import { requireAdminPage } from "@/lib/auth";
import { listCategories } from "@/lib/content";
import { bindings } from "@/lib/server";
export const metadata = { title: "Categories" };
export default async function Page() {
  await requireAdminPage("/admin/categories");
  const [categories, usage] = await Promise.all([
    listCategories(),
    bindings()
      .prepare(
        "SELECT category_id AS id, count(*) AS n FROM works WHERE category_id IS NOT NULL GROUP BY category_id",
      )
      .all<{ id: string; n: number }>(),
  ]);
  return (
    <Categories
      categories={categories}
      usage={Object.fromEntries(usage.results.map((r) => [r.id, Number(r.n)]))}
    />
  );
}
