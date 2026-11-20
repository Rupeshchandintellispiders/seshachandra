# Seshachandra Creations

A Telugu-first literary site with a standard Next.js frontend/API, MySQL content storage, private S3-compatible uploads, and email/password admin authentication.

## Local startup

Requires Node.js 22.13+ and MySQL 8+. This checkout's ignored `.env` already contains your local database connection. Use `.env.example` for a new checkout.

```powershell
npm ci
npm run db:setup
npm run admin:create -- your@email.com
npm run dev
```

Open http://localhost:4173 and sign in at http://localhost:4173/admin/login using the admin password you created. Old automatic ChatGPT/development sign-in has been removed. If you use `127.0.0.1` instead of `localhost`, set `SITE_URL` to that exact origin or leave it unset locally.

If your global Node is still version 20, use Node 22 through npx:

```powershell
npx --yes --package=node@22 node scripts/db-setup.mjs
npx --yes --package=node@22 node scripts/admin-create.mjs your@email.com
npx --yes --package=node@22 node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4173
```

The local MySQL database contains the imported channel library: 109 video entries including 27 Shorts. Existing categories, stories, videos, IDs and URLs are preserved by the authentication migration. Local file storage is available during development; production requires private object storage.

## Vercel and online services

Follow [VERCEL_SETUP.md](./VERCEL_SETUP.md) for cloud MySQL, private R2/S3 storage, copying the existing content/files, creating the production admin and Vercel settings. Deployment is user-managed. The app does not require a ChatGPT/Sites proxy.

## Commands

- `npm run dev`: Next.js local server, port 4173.
- `npm run build`: standard Next.js production build using Webpack.
- `npm start`: local preview of the built production server. HTTPS is required for production Secure session cookies; use the development server for ordinary HTTP admin testing.
- `npm run db:setup`: apply pending versioned MySQL migrations without reseeding.
- `npm run admin:create -- EMAIL`: create/reset an admin with a hidden password prompt; reset revokes its sessions.
- `npm run db:export`: export content to ignored `outputs/content-export.json`, excluding all admin/auth tables.
- `npm run db:import -- FILE`: import content into empty content tables; preserves existing target data by refusing nonempty targets.
- `npm run files:migrate`: copy existing local attachments to the configured private object store.
- `npm run typecheck`, `npm test`: TypeScript and validation/password unit checks.
- `npm run test:vercel` (also `test:integration`): disposable-admin login/session/upload checks using local MySQL and an isolated S3 protocol test server. It starts its own Next.js dev server on port 4175 and requires that port to be free. It never contacts production storage.

## Code

`app/api/` contains all server routes. `lib/auth.ts` verifies database-backed sessions, `lib/password.mjs` handles scrypt, `db/mysql.ts` pools connections, and `lib/storage.ts` handles local/private-cloud files. `migrations/mysql/` contains the active versioned schema. `components/` contains the bilingual UI. The legacy Vinext/Cloudflare scaffold is inactive; normal commands use Next.js. The prior one-time channel importer and its ignored metadata snapshots are retained for auditing, not automatic synchronization.

No credentials, default admin passwords, local database data, or attachment files should be committed. `.env*`, `outputs/` and `data/` remain ignored. Keep `.env.example` tracked. Use a separate cloud environment file with `node --env-file=.env.remote ...` when operating on cloud MySQL.
