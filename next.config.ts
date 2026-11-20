import type { NextConfig } from "next";

// Headers for every response. The Content-Security-Policy is set per request
// in proxy.ts because it carries a fresh nonce.
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Browsers only honour HSTS over HTTPS; local http development is unaffected.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  serverExternalPackages: ["mysql2"],
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: security },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};
export default config;
