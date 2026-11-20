import { WorksTable } from "@/components/admin/works-table";
import { requireAdminPage } from "@/lib/auth";
import { listCategories, listWorks, param } from "@/lib/content";
export const metadata = { title: "Works" };
const keys = ["q", "type", "status", "category", "sort", "page"] as const;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const query = new URLSearchParams();
  for (const k of keys) if (param(search[k])) query.set(k, param(search[k]));
  await requireAdminPage("/admin/works" + (query.size ? "?" + query : ""));
  const [result, categories] = await Promise.all([
    listWorks({
      admin: true,
      q: param(search.q),
      type: param(search.type),
      status: param(search.status),
      category: param(search.category),
      sort: param(search.sort),
      page: param(search.page),
    }),
    listCategories(),
  ]);
  return (
    <WorksTable
      key={query.toString()}
      result={result}
      categories={categories}
      query={query.toString()}
    />
  );
}
