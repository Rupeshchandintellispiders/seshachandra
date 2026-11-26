import type { Metadata } from "next";
import "./globals.css";
import "./admin.css";
import { LanguageProvider } from "@/components/shell";
import { currentLanguage } from "@/lib/content";
import { logoUrl } from "@/lib/site-logo";

export async function generateMetadata(): Promise<Metadata> {
  // The uploaded logo doubles as the browser tab icon and default share image.
  const logo = await logoUrl();
  return {
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:4173"),
    title: {
      default: "Seshachandra Creations | శేషచంద్ర క్రియేషన్స్",
      template: "%s | Seshachandra Creations",
    },
    description:
      "తెలుగు కథలు, రచనలు, వీడియోలు — Telugu stories, literature and videos from Seshachandra Creations.",
    openGraph: {
      type: "website",
      siteName: "Seshachandra Creations",
      locale: "te_IN",
      alternateLocale: ["en_IN"],
      ...(logo ? { images: [{ url: logo, alt: "Seshachandra Creations" }] } : {}),
    },
    twitter: { card: "summary_large_image" },
    icons: logo
      ? { icon: logo, shortcut: logo, apple: logo }
      : { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, logo] = await Promise.all([currentLanguage(), logoUrl()]);
  return (
    <html lang={lang}>
      <body>
        <LanguageProvider initialLang={lang} logo={logo}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
