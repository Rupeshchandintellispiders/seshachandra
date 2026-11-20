import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { hashPassword } from "../lib/password.mjs";
const base = "http://127.0.0.1:4175";
const c = await mysql.createConnection(mysqlOptions());
const email = "qa-vercel-" + Date.now() + "@example.test";
let password = crypto.randomUUID() + "A!";
const startedAt = Date.now();
const adminId = crypto.randomUUID();
const objects = new Map();
let child;
let passed = 0;
const uploaded = [],
  works = [];
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const k = decodeURIComponent(url.pathname);
  if (req.method === "PUT") {
    const chunks = [];
    for await (const b of req) chunks.push(b);
    objects.set(k, {
      bytes: Buffer.concat(chunks),
      mime: req.headers["content-type"],
    });
    res.statusCode = 200;
    res.end();
    return;
  }
  if (req.method === "DELETE") {
    objects.delete(k);
    res.statusCode = 204;
    res.end();
    return;
  }
  const object = objects.get(k);
  if (!object) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader("content-type", object.mime);
  res.setHeader("content-length", object.bytes.length);
  res.setHeader("etag", '"test-etag"');
  res.statusCode = 200;
  res.end(req.method === "HEAD" ? undefined : object.bytes);
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const endpoint = "http://127.0.0.1:" + mock.address().port;
let cookie = "";
async function call(
  path,
  { method = "GET", body, auth = true, origin = base, headers = {} } = {},
) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(auth && cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
}
async function check(path, options, status) {
  const r = await call(path, options);
  assert.equal(
    r.status,
    status,
    path + " " + (r.status !== status ? await r.text() : ""),
  );
  passed++;
  return r;
}
async function login() {
  const r = await check(
    "/api/auth/login",
    { method: "POST", body: { email, password }, auth: false },
    200,
  );
  cookie = r.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(r.headers.get("set-cookie"), /SameSite=strict/i);
  passed += 2;
}
try {
  const [before] = await c.query("SELECT COUNT(*) total FROM works");
  await c.execute("INSERT INTO admins(id,email,password_hash) VALUES(?,?,?)", [
    adminId,
    email,
    await hashPassword(password),
  ]);
  const log = createWriteStream("outputs/vercel-test-server.log");
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "4175",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "development",
        SITE_URL: base,
        S3_ENDPOINT: endpoint,
        S3_REGION: "auto",
        S3_BUCKET: "test-bucket",
        S3_ACCESS_KEY_ID: "test-access",
        S3_SECRET_ACCESS_KEY: "test-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  let ready = false;
  for (let i = 0; i < 180; i++) {
    try {
      const r = await fetch(base + "/api/session", {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        await r.text();
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null)
      throw Error("Next dev server exited; see outputs/vercel-test-server.log");
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Server did not start");
  console.log("Server ready; testing real credentials and storage flow.");
  await check("/admin", {}, 307);
  // Every admin URL redirects to sign-in and remembers where you were going.
  const guarded = await check("/admin/works?status=draft", { auth: false }, 307);
  assert.equal(
    new URL(guarded.headers.get("location"), base).pathname +
      new URL(guarded.headers.get("location"), base).search,
    "/admin/login?next=%2Fadmin%2Fworks%3Fstatus%3Ddraft",
  );
  const loginPage = await check("/admin/login", { auth: false }, 200);
  assert.equal(loginPage.headers.get("x-frame-options"), "DENY");
  assert.match(loginPage.headers.get("x-robots-tag"), /noindex/);
  passed += 3;
  // A well-formed but unknown session token is still refused by the server.
  await check(
    "/admin/works",
    { auth: false, headers: { cookie: "sc_admin_session=" + "a".repeat(64) } },
    307,
  );
  for (const p of [
    "/api/works",
    "/api/categories",
    "/api/settings",
    "/api/uploads",
    "/api/import",
    "/api/storage/presign",
    "/api/storage/complete",
  ])
    await check(
      p,
      {
        method: p.endsWith("settings") ? "PUT" : "POST",
        body: {},
        auth: false,
      },
      401,
    );
  await check(
    "/api/works",
    {
      method: "POST",
      body: {},
      auth: false,
      headers: {
        "oai-authenticated-user-id": "local_seedy",
        "oai-authenticated-user-email": "seedy@sites.test",
      },
    },
    401,
  );
  await check(
    "/api/auth/login",
    { method: "POST", body: { email, password }, origin: "https://evil.test" },
    403,
  );
  await check(
    "/api/auth/login",
    { method: "POST", body: { email, password: "wrong" } },
    401,
  );
  await login();
  await check("/admin", {}, 200);
  for (const p of [
    "/admin/works",
    "/admin/works?status=draft&type=video",
    "/admin/works/new",
    "/admin/categories",
    "/admin/settings",
    "/admin/import",
    "/admin/account",
  ])
    await check(p, {}, 200);
  // After sign-in, only same-site admin paths are honoured as the destination.
  for (const [next, expected] of [
    ["/admin/works", "/admin/works"],
    ["https://evil.test/admin", "/admin"],
    ["//evil.test", "/admin"],
    ["/admin/login", "/admin"],
  ]) {
    const r = await check(
      "/api/auth/login",
      { method: "POST", body: { email, password, next }, auth: false },
      200,
    );
    assert.equal((await r.json()).next, expected);
    passed++;
  }
  assert.equal(
    (await (await check("/api/session", {}, 200)).json()).admin,
    true,
  );
  passed++;
  await check(
    "/api/storage/presign",
    {
      method: "POST",
      body: { name: "bad.svg", mime: "image/svg+xml", size: 20 },
    },
    400,
  );
  await check(
    "/api/storage/presign",
    {
      method: "POST",
      body: { name: "huge.pdf", mime: "application/pdf", size: 10485761 },
    },
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM9sAAAAASUVORK5CYII=",
    "base64",
  );
  async function prepare(name, mime, bytes) {
    const ticket = await (
      await check(
        "/api/storage/presign",
        { method: "POST", body: { name, mime, size: bytes.length } },
        200,
      )
    ).json();
    assert.ok(new URL(ticket.url).searchParams.has("X-Amz-Signature"));
    assert.equal(new URL(ticket.url).searchParams.get("X-Amz-Expires"), "120");
    passed += 2;
    const put = await fetch(ticket.url, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: bytes,
    });
    assert.equal(put.status, 200);
    return ticket;
  }
  const ticket = await prepare("తెలుగు.png", "image/png", png);
  const complete = await (
    await check(
      "/api/storage/complete",
      { method: "POST", body: { id: ticket.id } },
      201,
    )
  ).json();
  uploaded.push(complete.id);
  assert.ok(objects.has("/test-bucket/files/" + complete.id));
  assert.ok(!objects.has("/test-bucket/staging/" + complete.id));
  passed += 2;
  await check(
    "/api/storage/complete",
    { method: "POST", body: { id: ticket.id } },
    400,
  );
  await check("/api/uploads/" + complete.id, { auth: false }, 401);
  const signed = await check("/api/uploads/" + complete.id, {}, 302);
  assert.match(signed.headers.get("location"), /X-Amz-Signature/);
  passed++;
  const bad = await prepare(
    "bad.pdf",
    "application/pdf",
    Buffer.from("<script>invalid</script>"),
  );
  await check(
    "/api/storage/complete",
    { method: "POST", body: { id: bad.id } },
    400,
  );
  assert.ok(!objects.has("/test-bucket/files/" + bad.id));
  passed++;
  const slug = "qa-vercel-" + Date.now();
  const row = await (
    await check(
      "/api/works",
      {
        method: "POST",
        body: {
          type: "story",
          title: "QA Vercel upload",
          slug,
          status: "draft",
          body: "పరీక్ష మాత్రమే",
          attachmentIds: [complete.id],
        },
      },
      201,
    )
  ).json();
  works.push(row.id);
  await check("/admin/works/" + row.id, {}, 200);
  // Bulk actions: an empty story is skipped when publishing.
  const emptyStory = await (
    await check(
      "/api/works",
      {
        method: "POST",
        body: { type: "story", title: "QA empty", slug: slug + "-empty" },
      },
      201,
    )
  ).json();
  works.push(emptyStory.id);
  const both = [row.id, emptyStory.id];
  await check(
    "/api/works/bulk",
    { method: "POST", body: { ids: both, action: "publish" }, auth: false },
    401,
  );
  await check(
    "/api/works/bulk",
    {
      method: "POST",
      body: { ids: both, action: "publish" },
      origin: "https://evil.test",
    },
    403,
  );
  await check(
    "/api/works/bulk",
    { method: "POST", body: { ids: ["not-a-uuid"], action: "publish" } },
    400,
  );
  const published2 = await (
    await check("/api/works/bulk", { method: "POST", body: { ids: both, action: "publish" } }, 200)
  ).json();
  assert.deepEqual(published2, { changed: 1, skipped: 1 });
  passed++;
  await check("/api/works/bulk", { method: "POST", body: { ids: both, action: "feature" } }, 200);
  assert.equal(
    (await (await check("/api/works/" + row.id + "?admin=1", {}, 200)).json()).featured,
    true,
  );
  passed++;
  await check(
    "/api/works/bulk",
    { method: "POST", body: { ids: [row.id], action: "unpublish" } },
    200,
  );
  await check(
    "/api/works/bulk",
    { method: "POST", body: { ids: [emptyStory.id], action: "delete" } },
    200,
  );
  await check("/api/works/" + emptyStory.id + "?admin=1", {}, 404);
  const work = await (
    await check("/api/works/" + row.id + "?admin=1", {}, 200)
  ).json();
  await check(
    "/api/works/" + row.id,
    { method: "PUT", body: { ...work, status: "published" } },
    200,
  );
  await check("/api/uploads/" + complete.id, { auth: false }, 302);
  // Public pages are server-rendered: content must be in the first HTML response.
  async function page(path, status, options = {}) {
    const r = await check(path, { auth: false, ...options }, status);
    return r.text();
  }
  const published = await page("/work/" + slug, 200);
  assert.match(published, /QA Vercel upload/);
  assert.match(published, /<script type="application\/ld\+json">[^<]*"@type":"ShortStory"/);
  assert.match(published, /<meta property="og:title" content="QA Vercel upload"/);
  passed += 3;
  const search = await page("/library?q=QA+Vercel+upload", 200);
  assert.match(search, /class="card" href="\/work\/[^"]*qa-vercel-/);
  assert.match(search, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(search, /Loading…|లోడ్ అవుతోంది/);
  passed += 3;
  const home = await page("/", 200);
  assert.match(home, /class="card"/);
  assert.doesNotMatch(home, /Loading…|లోడ్ అవుతోంది/);
  passed += 2;
  assert.match(await page("/about", 200), /<link rel="canonical" href="[^"]*\/about"/);
  passed++;
  const english = await page("/library", 200, {
    headers: { cookie: "sc-language=en" },
  });
  assert.match(english, /<html lang="en"/);
  assert.match(english, /The library/);
  assert.match(await page("/library", 200), /<html lang="te"/);
  passed += 3;
  await check(
    "/api/works/" + row.id,
    { method: "PUT", body: { ...work, status: "draft" } },
    200,
  );
  await check("/api/uploads/" + complete.id, { auth: false }, 401);
  // Drafts are hidden from the public, including the preview URL without a session.
  await page("/work/" + slug, 404);
  await page("/work/" + slug + "?preview=1", 404);
  assert.doesNotMatch(
    await page("/library?q=QA+Vercel+upload", 200),
    /qa-vercel-/,
  );
  passed++;
  const preview = await check("/work/" + slug + "?preview=1", {}, 200);
  assert.match(await preview.text(), /QA Vercel upload/);
  passed++;
  await check(
    "/api/auth/logout",
    { method: "POST", body: {}, origin: "https://evil.test" },
    403,
  );
  const oldCookie = cookie;
  await check("/api/auth/logout", { method: "POST", body: {} }, 200);
  await check("/api/works?admin=1", { headers: { cookie: oldCookie } }, 401);
  const rateEmail = "blocked-" + Date.now() + "@example.test";
  for (let i = 0; i < 5; i++)
    await check(
      "/api/auth/login",
      {
        method: "POST",
        body: { email: rateEmail, password: "wrong" },
        auth: false,
      },
      401,
    );
  await check(
    "/api/auth/login",
    {
      method: "POST",
      body: { email: rateEmail, password: "wrong" },
      auth: false,
    },
    429,
  );
  // The strict limit is per email and address, so the owner can still sign
  // in from elsewhere while a stranger is blocked.
  await check(
    "/api/auth/login",
    {
      method: "POST",
      body: { email: rateEmail, password: "wrong" },
      auth: false,
      headers: { "x-real-ip": "203.0.113.9" },
    },
    401,
  );
  await login();
  // Password change: needs the current password, signs out other devices.
  const firstCookie = cookie;
  await login();
  const secondCookie = cookie;
  await check(
    "/api/auth/password",
    { method: "POST", body: { current: "wrong", next: "another-long-password" } },
    400,
  );
  await check(
    "/api/auth/password",
    { method: "POST", body: { current: password, next: "short" } },
    400,
  );
  await check(
    "/api/auth/password",
    {
      method: "POST",
      body: { current: password, next: "another-long-password" },
      origin: "https://evil.test",
    },
    403,
  );
  const oldPassword = password;
  password = crypto.randomUUID() + "B!";
  await check(
    "/api/auth/password",
    { method: "POST", body: { current: oldPassword, next: password } },
    200,
  );
  await check(
    "/api/auth/login",
    { method: "POST", body: { email, password: oldPassword }, auth: false },
    401,
  );
  await check("/api/works?admin=1", { headers: { cookie: firstCookie } }, 401);
  await check("/api/works?admin=1", { headers: { cookie: secondCookie } }, 200);
  // Sign out everywhere ends every session.
  await login();
  const thirdCookie = cookie;
  await check(
    "/api/auth/logout",
    { method: "POST", body: { everywhere: true } },
    200,
  );
  await check("/api/works?admin=1", { headers: { cookie: thirdCookie } }, 401);
  await check("/api/works?admin=1", { headers: { cookie: secondCookie } }, 401);
  await login();
  await c.execute("UPDATE admin_sessions SET expires_at=0 WHERE admin_id=?", [
    adminId,
  ]);
  await check("/api/works?admin=1", {}, 401);
  await login();
  await c.execute("UPDATE admins SET active=0 WHERE id=?", [adminId]);
  await check("/api/works?admin=1", {}, 401);
  for (const id of works) await c.execute("DELETE FROM works WHERE id=?", [id]);
  works.length = 0;
  const [after] = await c.query("SELECT COUNT(*) total FROM works");
  assert.equal(after[0].total, before[0].total);
  passed++;
  console.log(
    "PASS: " +
      passed +
      " production-auth/direct-upload checks. Existing " +
      before[0].total +
      " works preserved. Storage tested against an isolated S3-compatible test server; live R2 remains unverified.",
  );
} finally {
  for (const id of works) await c.execute("DELETE FROM works WHERE id=?", [id]);
  for (const id of uploaded)
    await c.execute("DELETE FROM uploads WHERE id=?", [id]);
  await c.execute("DELETE FROM upload_intents WHERE admin_id=?", [adminId]);
  await c.execute("DELETE FROM admins WHERE id=?", [adminId]);
  // Attempt counters are keyed by hashes; remove the ones this run created.
  await c.execute("DELETE FROM login_limits WHERE window_start>=?", [startedAt]);
  await c.end();
  if (child) {
    child.kill();
  }
  mock.close();
}
