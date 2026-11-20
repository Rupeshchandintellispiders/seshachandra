import { WorkEditor } from "@/components/admin/work-editor";
import { emptyWork } from "@/lib/validation";
import { requireAdminPage } from "@/lib/auth";
import { listCategories } from "@/lib/content";
import { randomUUID } from "node:crypto";
export const metadata = { title: "New work" };
export default async function Page() {
  await requireAdminPage("/admin/works/new");
  return (
    <WorkEditor
      initial={{ ...emptyWork, slug: "work-" + randomUUID().slice(0, 8) }}
      categories={await listCategories()}
    />
  );
}
