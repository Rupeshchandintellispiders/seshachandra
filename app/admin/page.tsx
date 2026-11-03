import { Admin } from "@/components/admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "నిర్వహణ · Admin",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Admin />;
}
