# Vercel setup — you handle deployment

The project now uses standard Next.js App Router. Frontend and APIs deploy together from this folder. No deployment commands are run by development, build or migration scripts.

## 1. Online MySQL

Use a managed MySQL 8+ service; Aiven for MySQL is one option. Choose the region nearest your Vercel function region. Check the provider's available plan and connection limit before purchasing.

1. Create a MySQL service in the provider console. Wait until it is running.
2. Open its connection information and record host, port, username, password and database. Use the actual database name supplied by the provider (Aiven commonly supplies `defaultdb`).
3. Download the CA certificate. Connections use TLS with certificate verification; never set `rejectUnauthorized=false`.
4. Use a dedicated application database/user where your provider permits it. The app needs SELECT/INSERT/UPDATE/DELETE. The account used for migration also needs CREATE/ALTER/INDEX/REFERENCES. The running app does not create tables.
5. Allow network access from Vercel and your computer. If you use provider IP allowlists, use Vercel's supported static-egress configuration or the provider's documented Vercel integration. A laptop-only IP allowlist will block Vercel.

Official connection instructions: https://aiven.io/docs/products/mysql/howto/connect-from-mysql-workbench
TLS certificates: https://aiven.io/docs/platform/concepts/tls-ssl-certificates

Create an ignored `.env.remote` locally with the cloud credentials:

```dotenv
MYSQL_HOST=your-service-host
MYSQL_PORT=your-service-port
MYSQL_USER=your-app-user
MYSQL_PASSWORD=your-cloud-password
MYSQL_DATABASE=defaultdb
MYSQL_SSL=true
MYSQL_CREATE_DATABASE=false
MYSQL_SSL_CA="-----BEGIN CERTIFICATE-----\nYOUR_CA_CONTENT\n-----END CERTIFICATE-----"
```

The CA value may also be a multiline PEM in Vercel's environment editor. The code handles escaped newline sequences. Use the CA provided by your database service, not the example text.

Run migrations from your computer against the cloud database:

```powershell
node --env-file=.env.remote scripts/db-setup.mjs
```

`MYSQL_CREATE_DATABASE=false` uses the existing provider database. Set it to `true` only if you want this script to create a database and the migration account has permission. Migrations are versioned, repeatable and preserve content. They must finish before you use the deployed admin/API. The build intentionally does not migrate the database.

## 2. Transfer the existing 109 video entries

Your laptop's MySQL data is not part of the Git repository or Vercel deployment. Export it explicitly:

```powershell
# Reads your local .env and exports categories/settings/uploads/works only.
npm run db:export
# Reads cloud values from .env.remote. Target content tables must be empty.
node --env-file=.env.remote scripts/import-content.mjs outputs/content-export.json
```

The import runs in a transaction and refuses to overwrite nonempty content tables. It preserves stable work IDs, categories and URLs. It does not copy admin password hashes or sessions. Keep `outputs/content-export.json` private as a local backup; it is ignored by Git.

If you have real PDF/image attachments, migrate their files separately as described below. Videos themselves stay on YouTube and do not require upload migration.

## 3. Private uploads with Cloudflare R2

R2 is S3-compatible. AWS S3 or another compatible private store can also be configured using the same variables.

1. Create an R2 bucket, for example `seshachandra-uploads`.
2. Keep public access disabled: do not enable an `r2.dev` public URL or public custom domain.
3. Create R2 S3 API credentials restricted to **Object Read & Write for this bucket**. Record the Access Key ID and Secret Access Key. Use the account's S3 endpoint, not the bucket's public URL.
4. Configure this bucket's CORS policy using `storage-cors.example.json`. Replace the example origins with your exact production domain, your exact Vercel production URL, and the local origin you use. Add individual preview origins only when needed. Do not put credentials in this JSON.
5. Set a lifecycle rule to delete the `staging/` prefix after one day. Incomplete or abandoned browser uploads can remain there. Do not apply this rule to `files/`.

```dotenv
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=seshachandra-uploads
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-key
```

Official R2 credential/presigned URL instructions: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
Official bucket CORS instructions: https://developers.cloudflare.com/r2/buckets/cors/

The admin browser uploads to a temporary private object using a two-minute signed URL. A protected finalize endpoint checks the expected size and the actual file signature, then writes the validated bytes to a permanent UUID key. This retains the 10 MB limit while avoiding Vercel's request-body limit. Supported types are PDF, JPEG, PNG and WebP; SVG/HTML are rejected. The endpoint never trusts a client-supplied permanent key or object URL.

Files are read through `/api/uploads/ID`. Published attachments get a one-minute signed download URL. Draft files require an active admin session before a URL is issued. A signed URL already issued can still work until its one-minute expiry after unpublishing. The bucket stays private. Set `SITE_URL` and CORS origins correctly or browsers will reject the upload.

### Existing local files

Add the S3 variables to your **local `.env`**, leaving the local MySQL values unchanged, then run:

```powershell
npm run files:migrate
```

This copies each local `data/uploads/ID` to `files/ID` in the cloud bucket and preserves IDs referenced by the exported database. It leaves local files in place and skips matching existing object sizes. Then transfer the content JSON to cloud MySQL. Missing local files stop migration with an error; restore those from your backup rather than creating fake replacements.

## 4. Create your production admin

Run this from your computer, using the cloud MySQL environment:

```powershell
node --env-file=.env.remote scripts/admin-create.mjs your@email.com
```

The script prompts twice for a hidden password, at least 12 characters. Use a unique strong password. There is no default admin, public registration or production development-login bypass. Do not use your database password as your admin password.

Sign in at `https://YOUR_SITE/admin/login` after deployment. The same login works locally after you create an admin in the local database:

```powershell
npm run admin:create -- your@email.com
```

Passwords are salted with scrypt. Sessions are random tokens stored in HttpOnly/SameSite=Strict cookies (Secure in production), with only token hashes stored in MySQL. Sessions expire after eight hours. All content mutations, upload authorization/finalization, imports and settings enforce server-side admin checks and same-origin validation. Login is rate-limited by normalized email to five attempts per 15 minutes, including attempts against unknown accounts. Sign-out deletes the server session. Rerun `admin-create.mjs` for an existing email to reset its password and revoke that admin's sessions. There is no password-reset email service; the site owner runs this command.

## 5. Vercel project settings

Select the **Next.js** framework preset, repository root as the Root Directory, Node.js **22.x**, install command `npm ci`, and build command `npm run build`. The build uses Next.js's Webpack mode, which is supported by Vercel. Output Directory should use the framework default. `vercel.json` records the framework/install/build settings.

Set these server-only environment variables in Vercel for the appropriate Production/Preview environments:

| Variable | Value |
| --- | --- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Cloud MySQL connection details |
| `MYSQL_SSL` | `true` |
| `MYSQL_SSL_CA` | Provider CA PEM, when required by your provider |
| `SITE_URL` | Exact origin, e.g. `https://your-project.vercel.app`, no trailing slash |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Private object-storage settings |
| `YOUTUBE_API_KEY` | Optional, for the admin's YouTube Data API importer |

Do not prefix any credentials with `NEXT_PUBLIC_`. Vercel provides `NODE_ENV` itself. Do not copy your laptop's `127.0.0.1`, local root credentials, `UPLOAD_DIRECTORY`, `ADMIN_SETUP_PASSWORD`, or the obsolete `ADMIN_USER_IDS` setting into Vercel. Production refuses local filesystem uploads when S3 is missing.

For a preview deployment, set its `SITE_URL` to that preview origin, or omit `SITE_URL` in Preview so request-origin checks use the current request origin. Add the exact preview origin to bucket CORS when testing uploads. Prefer a separate preview database/bucket for changes that could affect production data.

The app uses a small MySQL pool of two connections per running server instance; ensure your provider's total connection allowance supports your Vercel concurrency. Keep the function region close to the database. For high traffic, add the provider's supported connection proxy rather than increasing every instance's pool blindly.

Official Vercel framework guide: https://vercel.com/docs/frameworks/full-stack/nextjs
Vercel upload-size context: https://vercel.com/docs/vercel-blob/server-upload

## 6. Verify after you deploy

1. Open the public library and confirm the transferred 109 video entries and category counts.
2. Sign in at `/admin/login`. Save a draft, preview it, publish/unpublish it and confirm public draft exclusion.
3. Upload a real image and a PDF, including one over 4.5 MB but under 10 MB. Confirm attachments open, draft files require login, and a renamed HTML/SVG file is rejected.
4. Sign out and confirm the old session cannot mutate data. Test a second browser/device.
5. Verify `SITE_URL` metadata/sitemap and your production domain, and confirm the bucket has no public access.

Local tests cannot prove the live cloud credentials, firewall, CORS or Vercel environment. Those require your actual services and deployment. Nothing has been deployed by this change.
