import { notFound } from "next/navigation";
import { Reader } from "@/components/public";
import { bindings, decodeWork, requireAdmin } from "@/lib/server";
import type { Work } from "@/lib/validation";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};
async function find(slug: string, preview = false) {
  if (preview) await requireAdmin();
  const row = await bindings()
    .prepare(
      `SELECT * FROM works WHERE slug=? ${preview ? "" : "AND status='published'"}`,
    )
    .bind(slug)
    .first<Record<string, unknown>>();
  return row ? (decodeWork(row) as Work) : null;
}
export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const preview = (await searchParams).preview === "1";
  if (preview)
    return { title: "Preview", robots: { index: false, follow: false } };
  const work = await find(slug);
  return {
    title: work?.title || "Not found",
    description: work?.description,
    alternates: { canonical: "/work/" + slug },
    robots: !work ? { index: false } : undefined,
  };
}
export default async function Page({ params, searchParams }: Props) {
  const work = await find(
    (await params).slug,
    (await searchParams).preview === "1",
  );
  if (!work) notFound();
  return (
    <Reader initial={work} preview={(await searchParams).preview === "1"} />
  );
}
