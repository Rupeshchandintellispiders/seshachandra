import { notFound } from "next/navigation";
import { Reader } from "@/components/public";
import { admin, bindings, decodeWork } from "@/lib/server";
import type { Work } from "@/lib/validation";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};
/** Drafts are only visible as a preview to a signed-in admin. */
async function canPreview(requested: boolean) {
  return requested && (await admin()).allowed;
}
async function find(slug: string, preview = false) {
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
  if (!work) return { title: "Not found", robots: { index: false } };
  const image = imageFor(work);
  const description = summary(work);
  return {
    title: work.title,
    description,
    alternates: { canonical: "/work/" + slug },
    openGraph: {
      type: work.type === "video" ? "video.other" : work.type === "book" ? "book" : "article",
      title: work.title,
      description,
      url: "/work/" + slug,
      ...(image ? { images: [{ url: image, alt: work.title }] } : {}),
      ...(work.type === "video" && work.youtubeId
        ? { videos: [{ url: "https://www.youtube.com/embed/" + work.youtubeId }] }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: work.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
/** Share-preview image: YouTube thumbnail for videos, else the cover upload. */
function imageFor(work: Work) {
  if (work.type === "video" && work.youtubeId)
    return `https://i.ytimg.com/vi/${work.youtubeId}/hqdefault.jpg`;
  return work.coverId ? "/api/uploads/" + work.coverId : undefined;
}
function summary(work: Work) {
  const text = (work.description || work.body || "")
    .replace(/[*#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 200 ? text.slice(0, 197) + "…" : text || undefined;
}
function structuredData(work: Work) {
  const origin = process.env.SITE_URL || "http://localhost:4173";
  const url = origin + "/work/" + work.slug;
  const image = imageFor(work);
  const common = {
    "@context": "https://schema.org",
    name: work.title,
    description: summary(work),
    url,
    inLanguage: "te",
    keywords: work.tags.join(", ") || undefined,
    datePublished: work.publicationDate || work.createdAt.slice(0, 10),
    dateModified: work.updatedAt,
    publisher: { "@type": "Organization", name: "Seshachandra Creations", url: origin },
    ...(image ? { image: image.startsWith("/") ? origin + image : image } : {}),
  };
  if (work.type === "video")
    return {
      ...common,
      "@type": "VideoObject",
      thumbnailUrl: image,
      uploadDate: common.datePublished,
      embedUrl: "https://www.youtube.com/embed/" + work.youtubeId,
      contentUrl: "https://www.youtube.com/watch?v=" + work.youtubeId,
    };
  if (work.type === "book") return { ...common, "@type": "Book" };
  return { ...common, "@type": "ShortStory" };
}
export default async function Page({ params, searchParams }: Props) {
  const preview = await canPreview((await searchParams).preview === "1");
  const work = await find((await params).slug, preview);
  if (!work) notFound();
  return (
    <>
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData(work)).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Reader initial={work} preview={preview} />
    </>
  );
}
