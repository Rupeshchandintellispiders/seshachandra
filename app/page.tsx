import { Home } from "@/components/public";
import { listCategories, listWorks } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function Page() {
  const [latest, featured, cats] = await Promise.all([
    listWorks(),
    listWorks({ featured: true }),
    listCategories(),
  ]);
  return (
    <Home latest={latest.items} featured={featured.items} cats={cats} />
  );
}
