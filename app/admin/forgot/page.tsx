import { ForgotPassword } from "@/components/login";
import { mailConfigured } from "@/lib/mail";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ForgotPassword emailAvailable={mailConfigured()} />;
}
