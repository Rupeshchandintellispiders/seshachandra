import { SignUp } from "@/components/login";
import { findInvite } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin sign-up",
  robots: { index: false, follow: false },
};
/** Checks the invite without using it up; it is spent when the form is sent. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) || "";
  const invite = await findInvite(token);
  return <SignUp token={token} email={invite?.email ?? null} />;
}
