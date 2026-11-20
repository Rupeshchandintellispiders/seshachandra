import { About } from "@/components/public";
import { getSettings } from "@/lib/content";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "పరిచయం · About",
  description:
    "శేషచంద్ర క్రియేషన్స్ పరిచయం మరియు సంప్రదింపు వివరాలు — About Seshachandra Creations and how to get in touch.",
  alternates: { canonical: "/about" },
};
export default async function Page() {
  return <About settings={await getSettings()} />;
}
