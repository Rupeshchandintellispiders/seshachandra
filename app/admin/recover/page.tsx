import { RecoverAccount } from "@/components/login";
export const metadata = {
  title: "Use a recovery code",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <RecoverAccount />;
}
