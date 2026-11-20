import type { Metadata } from "next";
import { Library } from "@/components/public";
import { listCategories, listWorks, param } from "@/lib/content";
export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const filterKeys = ["q", "type", "category", "sort", "page"] as const;
const typeTitles: Record<string, string> = {
  story: "కథలు · Stories",
  video: "వీడియోలు · Videos",
  book: "పుస్తకాలు · Books",
};
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const search = await searchParams;
  const type = param(search.type);
  const filtered = filterKeys.some((k) => {
    const v = param(search[k]);
    return k !== "type" && v && !(k === "sort" && v === "newest");
  });
  return {
    title: typeTitles[type] || "రచనల సంపుటి · Library",
    description:
      "తెలుగు కథలు, వీడియోలు, పుస్తకాలు — Telugu stories, videos and books from Seshachandra Creations.",
    alternates: {
      canonical: typeTitles[type] ? "/library?type=" + type : "/library",
    },
    // Search and paging variations should not be indexed as separate pages.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}
export default async function Page({ searchParams }: Props) {
  const search = await searchParams;
  const filters = new URLSearchParams();
  for (const key of filterKeys)
    if (param(search[key])) filters.set(key, param(search[key]));
  const [result, cats] = await Promise.all([
    listWorks({
      type: param(search.type),
      category: param(search.category),
      q: param(search.q),
      page: param(search.page),
      sort: param(search.sort),
    }),
    listCategories(),
  ]);
  return <Library result={result} cats={cats} query={filters.toString()} />;
}
