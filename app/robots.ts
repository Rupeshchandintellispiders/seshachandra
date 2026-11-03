export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/*?preview="],
    },
    sitemap:
      "https://seshachandra-creations.principal-rie-mysuru.chatgpt.site/sitemap.xml",
  };
}
