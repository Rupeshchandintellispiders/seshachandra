# Seshachandra Creations

A Telugu-first literary website built with Vinext/Vite, React, Cloudflare D1 and R2. There are no sample stories, invented author details, or fabricated channel videos. Content starts empty.

## Local setup (Windows PowerShell)

Install Node.js 22.13+ (Node 22 LTS is recommended). Node 20 is intentionally rejected.

```powershell
cd C:\Users\Lenovo\Desktop\seshachandra
npm ci
npm run build
npm run db:setup
npm run dev -- --hostname 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173 and http://127.0.0.1:4173/admin. Click **Sign in with ChatGPT** on the admin page. The Sites starter simulates the `local_seedy` identity only during loopback development. No password or public registration is required. This identity is explicitly rejected in production, even if accidentally allowlisted.

This machine originally has Node 20. Until Node 22 is installed globally, the equivalent commands are:

```powershell
npx --yes --package=node@22 --package=npm@11 npm ci
npx --yes --package=node@22 node scripts/run-framework.mjs build
npx --yes --package=node@22 node scripts/db-setup.mjs
npx --yes --package=node@22 node scripts/run-framework.mjs dev --hostname 127.0.0.1 --port 4173
```

`npm run build` does not initialize the database. `npm run db:setup` applies pending migrations once, records them in `sc_migrations`, and preserves content. Never delete `.wrangler/state` if you need the local data. Stop the server and back up that entire directory before local migration experiments. A fresh checkout starts with an empty database. No data is seeded on startup.

## Checks

```powershell
npm run typecheck
npm test
npm run build
# With the development server running:
npm run test:integration
# Restart the development server, then:
node scripts/test-integration.mjs --verify-restart
```

The integration script only accepts loopback destinations. It uses clearly named QA content, cleans up its work rows, and leaves one draft (`qa-persist`) for the restart check. The restart check verifies and deletes that draft. It exercises real local D1/R2, not mock database calls. Uploaded QA files remain private in local storage; none are sent to production. The unit suite covers URL/date/content validation, upload signatures, and admin allowlist logic.

## Content workflow

- Add a story, video, or book in `/admin`. Save a draft, preview the saved version, then publish.
- Existing slugs are immutable on both client and server, so shared URLs remain stable.
- Videos accept a YouTube URL or ID. Enter the real title and description yourself when no API key is available. Thumbnails use the video ID and playback is a privacy-enhanced YouTube embed with no autoplay and a normal fallback link.
- Stories may contain Telugu plain text and PDF/scanned-image attachments. Font size is adjustable from 18 to 36px. React escapes all text; arbitrary HTML is not accepted.
- Books support covers, publication details and HTTPS purchase/contact links.
- Manage bilingual categories and their numeric display order. Deleting a category keeps its works.
- About text is independently editable in Telugu and English. Blank contact details are hidden. The language switch translates UI labels only, never literary content.
- Drafts are excluded from public APIs, individual pages and sitemap. Their files require admin access. Preview pages and admin pages have noindex metadata.
- File uploads accept PDF, JPEG, PNG and WebP up to 10 MB, validate MIME/signatures, and use random UUID storage keys. SVG and HTML uploads are rejected. Removing an attachment from a work does not erase its stored object; it becomes private if no published work references it. Add a retention/cleanup policy before substantial long-term use.

## Environment

`.env.example` documents the supported variables. For local optional credentials, copy it to `.dev.vars` (ignored by Git). Do not put secrets into public environment variables.

| Name | Purpose |
| --- | --- |
| `ADMIN_USER_IDS` | Comma-separated **Site-specific** ChatGPT user IDs allowed to administer production. Empty means no production admins. |
| `YOUTUBE_API_KEY` | Optional server-only YouTube Data API v3 key. Required only for channel import. |
| `DB` | Cloudflare D1 binding, declared in `.openai/hosting.json`, not a connection-string environment variable. |
| `BUCKET` | Cloudflare R2 binding for uploads, declared in `.openai/hosting.json`. |

The host must verify and inject ChatGPT identity headers. Do not expose the Worker through an alternate untrusted proxy that permits clients to forge those headers. The Sites deployment supplies the required authentication boundary.

To authorize production: sign in on the hosted `/admin` page, copy the displayed Site-specific user ID, configure it in `ADMIN_USER_IDS` through Sites runtime environment settings, and publish the environment change. No first-visitor admin claim or public registration exists. Local and hosted identities differ.

## YouTube import

The admin-only importer calls the supported YouTube Data API v3 `channels` and `playlistItems` endpoints for `@seshachandracreations1955`. Each request imports at most 50 entries and returns a continuation token for the next batch. Imported entries are drafts. A unique YouTube ID constraint and conflict-ignore behavior prevent duplicates and preserve all manual edits. Import progress and errors are shown in the admin UI. There is no automatic synchronization schedule. Actual credentialed import and live video playback require a real API key/video and have not been verified by the fixture tests.

## Deployment

The project is registered with Sites; reuse the exact `project_id` already recorded in `.openai/hosting.json`. Do not create a second Site. The default audience is owner-private; public access is a separate Sites audience setting.

1. Configure the runtime variables above in Sites. Keep secrets out of Git.
2. Run `npm run typecheck`, `npm test`, and build using the Sites plugin's `scripts/build-site.mjs` helper. Preserve its Vite integration.
3. Use the Sites `site-workflow.mjs` helper with a short-lived source credential supplied through hidden stdin to commit/push the exact source and package the deployment archive. Never save credentials in files or command arguments.
4. Save and deploy that exact commit/archive using Sites. The host provisions D1/R2 and applies committed Drizzle migrations before publishing the Worker.
5. Confirm deployment status, then test hosted sign-in, allowlist access and an actual upload. Local `.wrangler` data is not deployed; use admin tools to add real production content.
6. If the audience is changed to public, verify anonymous reading and rejection of unauthorized writes again. This application intentionally keeps all mutations behind server authorization and same-origin checks.

Future schema changes: edit `db/schema.ts`, run `npm run db:generate`, review the generated SQL, build and run `npm run db:setup` locally, then publish. Applied migrations must not be rewritten. Back up production D1/R2 with your hosting administrator's tools before destructive migrations. No legacy data could be migrated because the previous project was deleted.

## Structure

- `app/`: routes, metadata, robots and sitemap
- `components/`: bilingual shell, public pages, reader and admin editor
- `lib/validation.ts`: schemas, YouTube parsing, upload and admin policy validation
- `lib/server.ts`: authorization, database binding and API errors
- `app/api/[...path]/route.ts`: authenticated content/settings/categories/upload/import endpoints
- `db/`, `drizzle/`: database schema and versioned migrations
- `scripts/`: Node checks, migration setup, integration tests and retained Sites lifecycle tooling

## Verified locally on 2026-11-03

Dependency installation, TypeScript, unit tests, production build, fresh database initialization, repeat setup, 72 API/database/auth checks, and data persistence after restarting passed. Browser checks covered English/Telugu rendering, remembered interface language, local admin sign-in, draft saving, preview, reading font controls, focus outlines and 390px layout overflow. No real author content was available. Production auth, cross-device access, credentialed YouTube import and real-video playback require hosted verification and supplied credentials/content.
