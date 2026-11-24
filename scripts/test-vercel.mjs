import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { hashPassword } from "../lib/password.mjs";
const base = "http://127.0.0.1:4175";
const c = await mysql.createConnection(mysqlOptions());
let email = "qa-vercel-" + Date.now() + "@example.test";
const createdEmails = [];
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
// Minimal SMTP server that records messages instead of delivering them.
const mails = [];
const CRLF = "\r\n";
const smtp = net.createServer((socket) => {
  let buffer = "",
    inData = false,
    current = { to: [], data: "" };
  const reply = (line) => socket.write(line + CRLF);
  reply("220 test-mail ready");
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    while (true) {
      if (inData) {
        const end = buffer.indexOf(CRLF + "." + CRLF);
        if (end === -1) return;
        current.data = buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        inData = false;
        mails.push(current);
        current = { to: [], data: "" };
        reply("250 queued");
        continue;
      }
      const eol = buffer.indexOf(CRLF);
      if (eol === -1) return;
      const line = buffer.slice(0, eol);
      buffer = buffer.slice(eol + 2);
      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO" || verb === "HELO") reply("250 test-mail");
      else if (verb === "RCPT") {
        current.to.push(line.slice(line.indexOf(":") + 1).replace(/[<>\s]/g, ""));
        reply("250 ok");
      } else if (verb === "DATA") {
        inData = true;
        reply("354 send");
      } else if (verb === "QUIT") {
        reply("221 bye");
        socket.end();
      } else reply("250 ok");
    }
  });
});
await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
const decodeQuotedPrintable = (text) =>
  text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(smtp.address().port),
        SMTP_FROM: "Seshachandra Test <noreply@example.test>",
        SMTP_USER: "",
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
  // The site's own address is accepted even when it differs from SITE_URL
  // (Vercel preview URLs, custom domains); other sites still are not.
  await check(
    "/api/auth/login",
    {
      method: "POST",
      body: { email, password: "wrong" },
      origin: "https://preview-123.example.test",
      headers: { "x-forwarded-host": "preview-123.example.test", "x-forwarded-proto": "https" },
    },
    401,
  );
  await check(
    "/api/auth/login",
    {
      method: "POST",
      body: { email, password },
      origin: "https://evil.test",
      headers: { "x-forwarded-host": "preview-123.example.test", "x-forwarded-proto": "https" },
    },
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
  // Categories: create, edit, refuse edits to unknown ids, delete.
  const category = await (
    await check(
      "/api/categories",
      { method: "POST", body: { nameTe: "పరీక్ష", nameEn: "QA test", position: 9999 } },
      201,
    )
  ).json();
  await check(
    "/api/categories/" + category.id,
    { method: "PUT", body: { nameTe: "పరీక్ష 2", nameEn: "QA test 2", position: 9999 } },
    200,
  );
  const unknownCategory = crypto.randomUUID();
  await check(
    "/api/categories/" + unknownCategory,
    { method: "PUT", body: { nameTe: "x", nameEn: "x", position: 1 } },
    404,
  );
  const [ghost] = await c.execute("SELECT id FROM categories WHERE id=?", [unknownCategory]);
  assert.equal(ghost.length, 0);
  passed++;
  await check("/api/categories/" + category.id, { method: "DELETE" }, 200);
  // Security headers: every page gets a per-request script policy.
  const homeHeaders = await check("/", { auth: false }, 200);
  const policyA = homeHeaders.headers.get("content-security-policy");
  const policyB = (await check("/library", { auth: false }, 200)).headers.get(
    "content-security-policy",
  );
  assert.match(policyA, /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  assert.match(policyA, /frame-ancestors 'none'/);
  assert.match(policyA, /object-src 'none'/);
  assert.notEqual(policyA.match(/nonce-[^']+/)[0], policyB.match(/nonce-[^']+/)[0]);
  assert.match(await homeHeaders.text(), /<script[^>]+nonce="/);
  assert.equal(homeHeaders.headers.get("x-frame-options"), "DENY");
  assert.equal(homeHeaders.headers.get("x-content-type-options"), "nosniff");
  assert.match(homeHeaders.headers.get("permissions-policy"), /camera=\(\)/);
  passed += 8;
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
  // ---- Forgot password by email (captured by the local test mail server) ----
  const latestResetToken = async (to) => {
    for (let i = 0; i < 50 && !mails.some((m) => m.to.includes(to)); i++)
      await new Promise((r) => setTimeout(r, 100));
    const mail = mails.filter((m) => m.to.includes(to)).pop();
    assert.ok(mail, "reset email was not delivered");
    const token = decodeQuotedPrintable(mail.data).match(
      /\/admin\/reset\?token=([a-f0-9]{64})/,
    )?.[1];
    assert.ok(token, "reset email has no link");
    return token;
  };
  const forgotPage = await (await check("/admin/forgot", { auth: false }, 200)).text();
  assert.doesNotMatch(forgotPage, /can't send email yet|ఈమెయిల్ పంపే సేవ ఇంకా/);
  passed++;
  await check(
    "/api/auth/forgot",
    { method: "POST", body: { email }, auth: false, origin: "https://evil.test" },
    403,
  );
  // Unknown emails get the same answer and no email is sent.
  const mailsBefore = mails.length;
  const unknown = await check(
    "/api/auth/forgot",
    { method: "POST", body: { email: "nobody-" + Date.now() + "@example.test" }, auth: false },
    200,
  );
  assert.deepEqual(await unknown.json(), { ok: true, email: true });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(mails.length, mailsBefore);
  passed += 2;
  await check("/api/auth/forgot", { method: "POST", body: { email }, auth: false }, 200);
  const firstToken = await latestResetToken(email);
  // A newer request replaces the older link.
  mails.length = 0;
  await check("/api/auth/forgot", { method: "POST", body: { email }, auth: false }, 200);
  const resetToken = await latestResetToken(email);
  assert.notEqual(resetToken, firstToken);
  passed++;
  const resetPage = await (
    await check("/admin/reset?token=" + resetToken, { auth: false }, 200)
  ).text();
  assert.doesNotMatch(resetPage, /href="\/admin\/forgot"/);
  const badPage = await (
    await check("/admin/reset?token=" + "0".repeat(64), { auth: false }, 200)
  ).text();
  assert.match(badPage, /href="\/admin\/forgot"/);
  passed += 2;
  await check(
    "/api/auth/reset",
    { method: "POST", body: { token: firstToken, password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  await check(
    "/api/auth/reset",
    { method: "POST", body: { token: resetToken, password: "short" }, auth: false },
    400,
  );
  await login();
  const beforeReset = cookie;
  password = crypto.randomUUID() + "R!";
  await check(
    "/api/auth/reset",
    { method: "POST", body: { token: resetToken, password }, auth: false },
    200,
  );
  // The link works once, and a reset signs out every device.
  await check(
    "/api/auth/reset",
    { method: "POST", body: { token: resetToken, password: "another-long-password" }, auth: false },
    400,
  );
  await check("/api/works?admin=1", { headers: { cookie: beforeReset } }, 401);
  await login();
  // Too many reset requests for one email from one address are refused.
  const floodEmail = "flood-" + Date.now() + "@example.test";
  for (let i = 0; i < 3; i++)
    await check("/api/auth/forgot", { method: "POST", body: { email: floodEmail }, auth: false }, 200);
  await check("/api/auth/forgot", { method: "POST", body: { email: floodEmail }, auth: false }, 429);

  // ---- Recovery codes ----
  await check(
    "/api/auth/recovery-codes",
    { method: "POST", body: { current: password }, auth: false },
    401,
  );
  await check(
    "/api/auth/recovery-codes",
    { method: "POST", body: { current: "wrong-password" } },
    400,
  );
  const { codes } = await (
    await check("/api/auth/recovery-codes", { method: "POST", body: { current: password } }, 200)
  ).json();
  assert.equal(codes.length, 8);
  assert.ok(codes.every((code) => /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/.test(code)));
  assert.equal(new Set(codes).size, 8);
  const [stored] = await c.execute("SELECT code_hash FROM recovery_codes WHERE admin_id=?", [adminId]);
  assert.equal(stored.length, 8);
  assert.ok(stored.every((r) => !codes.some((code) => r.code_hash.includes(code))));
  passed += 4;
  await check(
    "/api/auth/recover",
    { method: "POST", body: { email, code: "AAAA-BBBB-CC", password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  await check(
    "/api/auth/recover",
    { method: "POST", body: { email: "nobody@example.test", code: codes[0], password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  const beforeRecover = cookie;
  password = crypto.randomUUID() + "C!";
  // Case, spaces and dashes are forgiven when typing a code.
  const typed = codes[0].toLowerCase().replace(/-/g, " ");
  const recovered = await (
    await check("/api/auth/recover", { method: "POST", body: { email, code: typed, password }, auth: false }, 200)
  ).json();
  assert.equal(recovered.codesLeft, 7);
  passed++;
  await check("/api/works?admin=1", { headers: { cookie: beforeRecover } }, 401);
  await check(
    "/api/auth/recover",
    { method: "POST", body: { email, code: codes[0], password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  await login();
  // New codes replace the old set.
  await check("/api/auth/recovery-codes", { method: "POST", body: { current: password } }, 200);
  await check(
    "/api/auth/recover",
    { method: "POST", body: { email, code: codes[1], password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  await check("/admin/account", {}, 200);
  for (const p of ["/admin/forgot", "/admin/reset", "/admin/recover"]) {
    const r = await check(p, { auth: false }, 200);
    assert.match(r.headers.get("x-robots-tag") || "", /noindex/);
    passed++;
  }
  // ---- Change email ----
  await login();
  const otherDevice = cookie;
  await login();
  const newEmail = "qa-renamed-" + Date.now() + "@example.test";
  await check(
    "/api/auth/email",
    { method: "POST", body: { email: newEmail, current: password }, auth: false },
    401,
  );
  await check(
    "/api/auth/email",
    { method: "POST", body: { email: newEmail, current: "wrong-password" } },
    400,
  );
  await check(
    "/api/auth/email",
    { method: "POST", body: { email: "not-an-email", current: password } },
    400,
  );
  await check(
    "/api/auth/email",
    { method: "POST", body: { email: newEmail, current: password }, origin: "https://evil.test" },
    403,
  );
  const changed = await (
    await check(
      "/api/auth/email",
      { method: "POST", body: { email: " " + newEmail.toUpperCase() + " ", current: password } },
      200,
    )
  ).json();
  assert.equal(changed.email, newEmail);
  passed++;
  // Other devices are signed out; this one stays in. The old email no longer works.
  await check("/api/works?admin=1", { headers: { cookie: otherDevice } }, 401);
  await check("/api/works?admin=1", {}, 200);
  await check("/api/auth/login", { method: "POST", body: { email, password }, auth: false }, 401);
  email = newEmail;
  await login();

  // ---- Invites and sign-up ----
  const invitee = "qa-invitee-" + Date.now() + "@example.test";
  createdEmails.push(invitee);
  await check("/api/auth/invites", { method: "POST", body: { email: invitee }, auth: false }, 401);
  await check(
    "/api/auth/invites",
    { method: "POST", body: { email: invitee }, origin: "https://evil.test" },
    403,
  );
  // An existing admin's email cannot be invited.
  await check("/api/auth/invites", { method: "POST", body: { email } }, 409);
  const first = await (await check("/api/auth/invites", { method: "POST", body: { email: invitee } }, 201)).json();
  const firstInviteToken = new URL(first.link).searchParams.get("token");
  assert.match(firstInviteToken, /^[a-f0-9]{64}$/);
  const [storedInvite] = await c.execute("SELECT token_hash FROM admin_invites WHERE id=?", [first.id]);
  assert.notEqual(storedInvite[0].token_hash, firstInviteToken);
  passed += 2;
  // Inviting again replaces the earlier link.
  const second = await (await check("/api/auth/invites", { method: "POST", body: { email: invitee } }, 201)).json();
  const inviteToken = new URL(second.link).searchParams.get("token");
  const oldPage = await (await check("/admin/signup?token=" + firstInviteToken, { auth: false }, 200)).text();
  assert.doesNotMatch(oldPage, new RegExp(invitee.replace(/[.]/g, "\\.")));
  const signupPage = await (await check("/admin/signup?token=" + inviteToken, { auth: false }, 200)).text();
  assert.match(signupPage, new RegExp(invitee.replace(/[.]/g, "\\.")));
  passed += 2;
  const accountPage = await (await check("/admin/account", {}, 200)).text();
  assert.match(accountPage, new RegExp(invitee.replace(/[.]/g, "\\.")));
  passed++;
  // No sign-up without a valid invite, and none from another site.
  await check("/api/auth/signup", { method: "POST", body: { token: firstInviteToken, password: "a-perfectly-fine-password" }, auth: false }, 400);
  await check("/api/auth/signup", { method: "POST", body: { token: "0".repeat(64), password: "a-perfectly-fine-password" }, auth: false }, 400);
  await check("/api/auth/signup", { method: "POST", body: { token: inviteToken, password: "short" }, auth: false }, 400);
  await check(
    "/api/auth/signup",
    { method: "POST", body: { token: inviteToken, password: "a-perfectly-fine-password" }, auth: false, origin: "https://evil.test" },
    403,
  );
  const inviteePassword = crypto.randomUUID() + "I!";
  const joined = await check(
    "/api/auth/signup",
    { method: "POST", body: { token: inviteToken, password: inviteePassword }, auth: false },
    201,
  );
  assert.equal((await joined.json()).email, invitee);
  const inviteeCookie = joined.headers.getSetCookie().map((s) => s.split(";")[0]).join("; ");
  assert.match(joined.headers.get("set-cookie"), /HttpOnly/i);
  passed += 2;
  // The new admin is signed in, can sign in again, and the link works only once.
  await check("/api/works?admin=1", { headers: { cookie: inviteeCookie } }, 200);
  await check("/admin/account?welcome=1", { headers: { cookie: inviteeCookie } }, 200);
  await check("/api/auth/login", { method: "POST", body: { email: invitee, password: inviteePassword }, auth: false }, 200);
  await check("/api/auth/signup", { method: "POST", body: { token: inviteToken, password: "another-long-password" }, auth: false }, 400);
  // Cancelling an invite makes its link stop working.
  const cancelEmail = "qa-cancel-" + Date.now() + "@example.test";
  const toCancel = await (await check("/api/auth/invites", { method: "POST", body: { email: cancelEmail } }, 201)).json();
  await check("/api/auth/invites/" + toCancel.id, { method: "DELETE", auth: false }, 401);
  await check("/api/auth/invites/" + toCancel.id, { method: "DELETE" }, 200);
  await check("/api/auth/invites/" + toCancel.id, { method: "DELETE" }, 404);
  await check(
    "/api/auth/signup",
    { method: "POST", body: { token: new URL(toCancel.link).searchParams.get("token"), password: "a-perfectly-fine-password" }, auth: false },
    400,
  );
  const [ghostAdmin] = await c.execute("SELECT id FROM admins WHERE email=?", [cancelEmail]);
  assert.equal(ghostAdmin.length, 0);
  passed++;
  const signedOutSignup = await check("/admin/signup", { auth: false }, 200);
  assert.match(signedOutSignup.headers.get("x-robots-tag") || "", /noindex/);
  passed++;
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
  for (const e of createdEmails)
    await c.execute("DELETE FROM admins WHERE email=?", [e]);
  // Attempt counters are keyed by hashes; remove the ones this run created.
  await c.execute("DELETE FROM login_limits WHERE window_start>=?", [startedAt]);
  await c.end();
  if (child) {
    child.kill();
  }
  mock.close();
  smtp.close();
}
