import { Shell } from "@/components/shell";
/** Public pages share the site header and footer; the admin has its own. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
