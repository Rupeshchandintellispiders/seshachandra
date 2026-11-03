# Seshachandra Creations

Telugu-first literary website using Vinext/Vite, React and your local MySQL server. This checkout runs on Node.js and stores uploaded files under `data/uploads`. No deployment is needed for local use.

## Start locally

Use Node.js 22.13 or newer. From PowerShell:

```powershell
cd C:\Users\Lenovo\Desktop\seshachandra
npm ci
# Copy .env.example to .env only for a new checkout; this checkout is already configured.
npm run db:setup
npm run dev -- --hostname 127.0.0.1 --port 4173
```

This computer currently has Node 20 globally. Until Node 22 is installed globally, use:

```powershell
npx --yes --package=node@22 node scripts/db-setup.mjs
npx --yes --package=node@22 node scripts/run-framework.mjs dev --hostname 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. At `/admin`, click Sign in with ChatGPT to enter the starter's loopback-only development admin session. Sign-out is available in the dashboard. This development identity is rejected in production.

## MySQL and uploads

The separate database is `seshachandra_creations`, with `utf8mb4` encoding for Telugu. Existing databases are not modified. Connection settings live in the ignored `.env` file: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`. `.env.example` contains placeholders only. Do not commit `.env`.

`npm run db:setup` creates the database if missing and applies versioned SQL files from `migrations/mysql/`. Applied migrations are tracked in `sc_migrations`. It does not reseed or erase content. MySQL DDL commits implicitly: the runner records completed statements so an interrupted migration can resume, but a crash between DDL completion and progress recording may require manual inspection before rerunning. Preserve applied migration files.

Content, categories, settings, and upload metadata are stored in MySQL. Files are stored separately in `UPLOAD_DIRECTORY`, defaulting to `data/uploads`. Back up both the MySQL database and this directory. Keep the upload directory on a persistent volume when you deploy. UUID file names, MIME/signature checks, size limits, admin authorization, and draft-file privacy remain enforced. Removing an attachment reference does not erase its underlying stored file.

The old `drizzle/` SQLite migrations and Cloudflare starter files are retained as historical scaffolding; the active Vite configuration uses Node and the active database code is `db/mysql.ts`. MySQL migrations are authoritative. No local D1 data is imported automatically. The previous local database contained only disposable QA fixtures, which had been removed.

## Content and administration

The site supports stories, videos and books, drafts/publishing, featured entries, previews, ordered bilingual categories, editable About/contact/social links, search/type/category filters, sorting, pagination, stable URLs and file attachments. Interface language and reading font size are device preferences; literary content is never automatically translated. Empty states remain until real content is added.

`YOUTUBE_API_KEY` is optional and server-only. The channel importer uses YouTube Data API v3 for `@seshachandracreations1955`, imports at most 50 videos per click as drafts, and preserves existing videos/manual edits by unique YouTube ID. There is no automatic schedule. Without a key, add a real YouTube URL/ID, title and description manually. Live API import and real playback remain unverified without credentials and real content.

## Checks

```powershell
npm run typecheck
npm test
npm run build
# With the local development server running:
npm run test:integration
# Restart the server, then verify persistence and remove the test fixture:
node scripts/test-integration.mjs --verify-restart
```

Integration tests only target loopback. They use clearly named QA content, clean their content rows, and leave one private draft for the restart check. QA upload objects remain local and private.

## Deployment is user-managed

Nothing in the normal dev/build/database commands deploys or pushes the project. Build with `npm run build`, then run the Node production server with `npm start`. Configure MySQL credentials and persistent upload storage on your chosen server.

The retained authentication integration expects a trusted ChatGPT identity proxy in production plus a Site-specific `ADMIN_USER_IDS` allowlist. Production admin authentication on a standalone hosting provider needs configuration or replacement before use; do not trust identity headers directly from visitors. The local development sign-in is for loopback development only. Public reading and database access run independently of production admin setup.

The prior private hosted copy is separate from this local checkout and has not been updated with the MySQL changes. No additional deployment or push has been performed.

## Channel library imported on 2026-11-03

Imported and published 109 publicly listed channel entries (82 standard videos and 27 Shorts) into local MySQL. Categories: Vemana Poetry 75, Ramayanam 18, Devotional Songs 5, Life & Motivational Songs 7, Love Songs 1, Animated Moral Stories 3. Titles, descriptions, publication dates and tags came from the public YouTube pages; topic categories were assigned during import. Shorts keep their topic category and have a Shorts tag. No video media was downloaded.

The one-time public metadata snapshots, category review, verification result and pre-import database backup are in ignored `outputs/`. `scripts/import-channel-metadata.mjs` validates those snapshots and previews the import; `--apply` writes to local MySQL in a transaction and preserves any existing video ID. This import is not an automatic synchronization service. The admin's supported YouTube Data API importer still requires `YOUTUBE_API_KEY` for future imports.

Verification: all 109 IDs and metadata matched public API results across 10 library pages; category counts and Shorts search matched; six category sample pages included the correct embed and no autoplay. Browser checks confirmed library cards, visible thumbnails and category filtering. YouTube reported embedding allowed for all 109; full playback of each video was not tested.
