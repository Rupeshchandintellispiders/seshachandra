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
const password = crypto.randomUUID() + "A!";
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
  const row = await (
    await check(
      "/api/works",
      {
        method: "POST",
        body: {
          type: "story",
          title: "QA Vercel upload",
          slug: "qa-vercel-" + Date.now(),
          status: "draft",
          body: "పరీక్ష మాత్రమే",
          attachmentIds: [complete.id],
        },
      },
      201,
    )
  ).json();
  works.push(row.id);
  const work = await (
    await check("/api/works/" + row.id + "?admin=1", {}, 200)
  ).json();
  await check(
    "/api/works/" + row.id,
    { method: "PUT", body: { ...work, status: "published" } },
    200,
  );
  await check("/api/uploads/" + complete.id, { auth: false }, 302);
  await check(
    "/api/works/" + row.id,
    { method: "PUT", body: { ...work, status: "draft" } },
    200,
  );
  await check("/api/uploads/" + complete.id, { auth: false }, 401);
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
  await c.execute("DELETE FROM login_limits WHERE identifier=SHA2(?,256)", [
    rateEmail,
  ]);
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
  await c.execute("DELETE FROM login_limits WHERE identifier=SHA2(?,256)", [
    email,
  ]);
  await c.end();
  if (child) {
    child.kill();
  }
  mock.close();
}
