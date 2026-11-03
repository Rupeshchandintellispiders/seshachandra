import { bindings } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function sitemap() {
  const origin =
    "https://seshachandra-creations.principal-rie-mysuru.chatgpt.site";
  const rows = await bindings()
    .prepare("SELECT slug,updated_at FROM works WHERE status='published'")
    .all<{ slug: string; updated_at: string }>();
  return [
    ...["", "/library", "/about"].map((path) => ({ url: origin + path })),
    ...rows.results.map((w) => ({
      url: origin + "/work/" + w.slug,
      lastModified: w.updated_at,
    })),
  ];
}
