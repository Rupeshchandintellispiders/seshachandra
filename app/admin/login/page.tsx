import { Login } from "@/components/login";
import { currentAdmin, safeNext } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reset?: string }>;
}) {
  const search = await searchParams;
  const raw = search.next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  if (await currentAdmin()) redirect(next);
  return (
    <Login next={next} expired={raw !== undefined} reset={search.reset === "1"} />
  );
}
