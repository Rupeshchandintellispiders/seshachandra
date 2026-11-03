import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://seshachandra-creations.principal-rie-mysuru.chatgpt.site",
  ),
  title: {
    default: "Seshachandra Creations | శేషచంద్ర క్రియేషన్స్",
    template: "%s | Seshachandra Creations",
  },
  description:
    "తెలుగు కథలు, రచనలు, వీడియోలు — Telugu stories, literature and videos from Seshachandra Creations.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="te">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
