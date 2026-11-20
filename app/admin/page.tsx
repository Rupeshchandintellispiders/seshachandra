import { Admin } from "@/components/admin";
import { currentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "నిర్వహణ · Admin",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentAdmin())) redirect("/admin/login");
  return <Admin />;
}
