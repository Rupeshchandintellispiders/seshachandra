import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/shell";
import { currentLanguage } from "@/lib/content";

export const metadata: Metadata = {
  metadataBase: new URL(
    (process.env.SITE_URL || "http://localhost:4173"),
  ),
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
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await currentLanguage();
  return (
    <html lang={lang}>
      <body>
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}

