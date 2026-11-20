import { notFound } from "next/navigation";
import { WorkEditor } from "@/components/admin/work-editor";
import { requireAdminPage } from "@/lib/auth";
import { getWorkForAdmin, listCategories } from "@/lib/content";
export const metadata = { title: "Edit work" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage("/admin/works/" + encodeURIComponent(id));
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const [work, categories] = await Promise.all([
    getWorkForAdmin(id),
    listCategories(),
  ]);
  if (!work) notFound();
  return <WorkEditor key={work.id} initial={work} categories={categories} />;
}
