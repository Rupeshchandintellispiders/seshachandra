# Local verification

Verified on 2026-11-04 against the local MySQL database.

- Six validation/password unit tests passed after upgrading to Zod 4.6.7.
- 58 end-to-end checks passed on Next.js 16.4.5: credentials, incorrect credentials, login rate limits, CSRF origin rejection, forged identity-header rejection, protected admin pages/APIs, session expiry, inactive-account rejection, logout revocation, direct browser-style uploads, signature validation, duplicate finalize rejection, private draft attachments and signed published downloads.
- The S3 upload tests used an isolated local S3-compatible protocol server. They did not contact a real R2/AWS bucket and do not prove provider CORS or credentials.
- Content export/import, refusing an import into nonempty tables, admin CLI creation/reset and session revocation passed in a temporary local database. That database was removed afterwards. Original 109 works were preserved.
- Production dependency audit reported zero known vulnerabilities. The retained, inactive legacy development toolchain still has npm audit advisories; none were present in the production dependency audit. No forced downgrade of ESLint or legacy tools was applied.
- Live Vercel, remote MySQL TLS/firewall, real bucket CORS and cross-device production sign-in still need verification after the owner configures and deploys the services.

No deployment, push, cloud database provisioning or cloud credential changes were performed in this task.

- The standard Next.js 16.4.5 Webpack production build passed, including TypeScript and static-page generation.
- The local `/admin/login` page returned HTTP 200 with email/password fields. Manual visual browser verification was unavailable because the browser automation connection failed twice.
- Remote MySQL TLS explicitly enables both certificate-chain and hostname verification. Actual provider certificates still require cloud testing.
