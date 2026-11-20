import { Login } from "@/components/login";
import { currentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (await currentAdmin()) redirect("/admin");
  return <Login />;
}
