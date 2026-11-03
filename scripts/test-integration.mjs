import assert from "node:assert/strict";
const base = process.env.TEST_ORIGIN || "http://127.0.0.1:4173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Integration tests are local-only.");
let cookie = "";
let passed = 0;
async function req(
  path,
  { method = "GET", body, auth = true, origin = base } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(auth && cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
    redirect: "manual",
  });
  return r;
}
async function check(path, options, status) {
  const r = await req(path, options);
  assert.equal(
    r.status,
    status,
    `${options?.method || "GET"} ${path}: ${r.status} ${r.status !== status ? await r.text() : ""}`,
  );
  passed++;
  return r;
}
const login = await fetch(base + "/signin-with-chatgpt?return_to=/admin", {
  redirect: "manual",
});
assert.equal(login.status, 302);
cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
assert.ok(cookie);
passed++;
const session = await (await check("/api/session", {}, 200)).json();
assert.equal(session.admin, true);
passed++;
if (process.argv.includes("--verify-restart")) {
  const rows = await (
    await check("/api/works?admin=1&q=qa-persist", {}, 200)
  ).json();
  assert.equal(rows.total, 1);
  await check("/api/works/" + rows.items[0].id, { method: "DELETE" }, 200);
  console.log(
    "PASS: content persisted across server restart; fixture removed.",
  );
  process.exit(0);
}
const stamp = Date.now();
const created = [];
let categoryId;
try {
  for (const path of [
    "/api/works",
    "/api/categories",
    "/api/settings",
    "/api/uploads",
    "/api/import",
  ])
    await check(
      path,
      {
        method: path.endsWith("settings") ? "PUT" : "POST",
        body: {},
        auth: false,
      },
      401,
    );
  await check("/api/works?admin=1", { auth: false }, 401);
  await check(
    "/api/works",
    { method: "POST", body: {}, origin: "https://evil.test" },
    403,
  );
  await check("/api/works", { method: "POST", body: { title: "" } }, 400);
  const category = await (
    await check(
      "/api/categories",
      {
        method: "POST",
        body: { nameTe: "పరీక్ష మాత్రమే", nameEn: "QA only", position: 99 },
      },
      200,
    )
  ).json();
  categoryId = category.id;
  const draft = {
    type: "story",
    title: "QA తెలుగు కథ " + stamp,
    slug: "qa-story-" + stamp,
    body: "ఇది పరీక్ష పాఠ్యం మాత్రమే.\nరెండవ పేరా.",
    description: "QA description unique",
    tags: ["qa-token"],
    categoryId,
    status: "draft",
    featured: true,
    publication: "",
    publicationDate: "2026-11-03",
  };
  const c = await (
    await check("/api/works", { method: "POST", body: draft }, 201)
  ).json();
  created.push(c.id);
  await check("/api/works/" + c.id, { auth: false }, 404);
  await check("/work/" + draft.slug, { auth: false }, 404);
  await check("/api/works/" + c.id + "?admin=1", {}, 200);
  await check("/work/" + draft.slug + "?preview=1", {}, 200);
  await check("/api/works", { method: "POST", body: draft }, 409);
  await check(
    "/api/works/" + c.id,
    { method: "PUT", body: { ...draft, slug: "changed" } },
    400,
  );
  const published = { ...draft, status: "published" };
  await check("/api/works/" + c.id, { method: "PUT", body: published }, 200);
  const publicRead = await (
    await check("/api/works/" + draft.slug, { auth: false }, 200)
  ).json();
  assert.equal(publicRead.body, draft.body);
  passed++;
  for (const q of ["QA description unique", "qa-token", "తెలుగు కథ"]) {
    const r = await (
      await check(
        "/api/works?q=" +
          encodeURIComponent(q) +
          "&type=story&category=" +
          categoryId,
        { auth: false },
        200,
      )
    ).json();
    assert.equal(r.total, 1);
    passed++;
  }
  const html = await (
    await check("/work/" + draft.slug, { auth: false }, 200)
  ).text();
  assert.ok(html.includes("ఇది పరీక్ష"));
  passed++;
  const fake = new FormData();
  fake.append(
    "file",
    new File(["<script>bad</script>"], "evil.pdf", { type: "application/pdf" }),
  );
  await check("/api/uploads", { method: "POST", body: fake }, 400);
  const oversize = new FormData();
  oversize.append(
    "file",
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    }),
  );
  const large = await req("/api/uploads", { method: "POST", body: oversize });
  assert.ok([400, 413].includes(large.status));
  passed++;
  const upload = new FormData();
  upload.append(
    "file",
    new File(["%PDF-1.4\n% QA only\n%%EOF"], "qa.pdf", {
      type: "application/pdf",
    }),
  );
  const file = await (
    await check("/api/uploads", { method: "POST", body: upload }, 201)
  ).json();
  await check("/api/uploads/" + file.id, { auth: false }, 401);
  await check("/api/uploads/" + file.id, {}, 200);
  await check(
    "/api/works/" + c.id,
    { method: "PUT", body: { ...published, attachmentIds: [file.id] } },
    200,
  );
  const attachment = await check(
    "/api/uploads/" + file.id,
    { auth: false },
    200,
  );
  assert.equal(attachment.headers.get("content-type"), "application/pdf");
  passed++;
  await check(
    "/api/works/" + c.id,
    { method: "PUT", body: { ...draft, attachmentIds: [file.id] } },
    200,
  );
  await check("/api/uploads/" + file.id, { auth: false }, 401);
  await check("/api/works/" + c.id, { auth: false }, 404);
  const video = {
    type: "video",
    title: "QA video fixture",
    slug: "qa-video-" + stamp,
    youtubeId: "https://youtu.be/abcdefghijk",
    status: "published",
  };
  const v = await (
    await check("/api/works", { method: "POST", body: video }, 201)
  ).json();
  created.push(v.id);
  await check(
    "/api/works",
    { method: "POST", body: { ...video, slug: "qa-video-duplicate-" + stamp } },
    409,
  );
  const embed = await (
    await check("/work/" + video.slug, { auth: false }, 200)
  ).text();
  assert.ok(embed.includes("youtube-nocookie.com/embed/abcdefghijk"));
  assert.ok(!embed.includes("autoplay=1"));
  passed++;
  const book = await (
    await check(
      "/api/works",
      {
        method: "POST",
        body: {
          type: "book",
          title: "QA book",
          slug: "qa-book-" + stamp,
          status: "published",
          externalUrl: "https://example.com",
        },
      },
      201,
    )
  ).json();
  created.push(book.id);
  for (let i = 0; i < 13; i++) {
    const row = await (
      await check(
        "/api/works",
        {
          method: "POST",
          body: {
            type: "book",
            title: "QA pagination " + i,
            slug: "qa-page-" + stamp + "-" + i,
            status: "published",
            tags: ["qa-pages-" + stamp],
          },
        },
        201,
      )
    ).json();
    created.push(row.id);
  }
  const paged = await (
    await check(
      "/api/works?q=qa-pages-" + stamp + "&page=2&sort=oldest",
      { auth: false },
      200,
    )
  ).json();
  assert.equal(paged.total, 13);
  assert.equal(paged.items.length, 1);
  passed++;
  const settings = await (await check("/api/settings", {}, 200)).json();
  await check(
    "/api/settings",
    { method: "PUT", body: { ...settings, aboutTe: "పరీక్ష" } },
    200,
  );
  assert.equal(
    (await (await req("/api/settings", { auth: false })).json()).aboutTe,
    "పరీక్ష",
  );
  await check("/api/settings", { method: "PUT", body: settings }, 200);
  await check("/api/categories/" + categoryId, { method: "DELETE" }, 200);
  categoryId = null;
  assert.equal(
    (await (await req("/api/works/" + c.id + "?admin=1")).json()).categoryId,
    null,
  );
  passed++;
  const noKey = await req("/api/import", { method: "POST", body: {} });
  assert.equal(noKey.status, 503);
  assert.equal((await noKey.json()).code, "YOUTUBE_KEY_MISSING");
  passed++;
  await check("/robots.txt", { auth: false }, 200);
  const sitemap = await (
    await check("/sitemap.xml", { auth: false }, 200)
  ).text();
  assert.ok(!sitemap.includes(draft.slug));
  passed++;
  const keep = await (
    await check(
      "/api/works",
      {
        method: "POST",
        body: {
          type: "book",
          title: "qa-persist",
          slug: "qa-persist",
          status: "draft",
        },
      },
      201,
    )
  ).json();
  console.log("Persistence fixture:", keep.id);
  const logout = await fetch(base + "/signout-with-chatgpt?return_to=/admin", {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(logout.status, 302);
  assert.ok(logout.headers.get("set-cookie")?.includes("Max-Age=0"));
  passed++;
  console.log(
    `PASS: ${passed} API/database/auth checks. Live YouTube playback and credentialed import are not claimed.`,
  );
} finally {
  for (const id of created) await req("/api/works/" + id, { method: "DELETE" });
  if (categoryId)
    await req("/api/categories/" + categoryId, { method: "DELETE" });
}
