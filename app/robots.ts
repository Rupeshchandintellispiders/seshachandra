export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/*?preview="],
    },
    sitemap:
      (process.env.SITE_URL || "http://localhost:4173") + "/sitemap.xml",
  };
}

