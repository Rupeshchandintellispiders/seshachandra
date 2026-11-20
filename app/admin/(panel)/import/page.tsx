import { YoutubeImport } from "@/components/admin/youtube-import";
import { requireAdminPage } from "@/lib/auth";
export const metadata = { title: "YouTube import" };
export default async function Page() {
  await requireAdminPage("/admin/import");
  return <YoutubeImport keyConfigured={!!process.env.YOUTUBE_API_KEY} />;
}
