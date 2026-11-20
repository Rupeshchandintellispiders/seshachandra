import {cloudStorage,downloadUrl} from '@/lib/storage';
import { env } from "@/lib/environment";
import { listWorks, listCategories, getSettings } from "@/lib/content";
import {
  bindings,
  admin,
  requireAdmin,
  ApiError,
  errorResponse,
  decodeWork,
} from "@/lib/server";
import {
  workSchema,
  categorySchema,
  settingsSchema,
  youtubeId,
  validFile,
} from "@/lib/validation";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const columns = [
  "type",
  "title",
  "slug",
  "description",
  "body",
  "tags",
  "category_id",
  "status",
  "featured",
  "youtube_id",
  "publication",
  "publication_date",
  "attribution",
  "external_url",
  "cover_id",
  "attachment_ids",
];
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path;
    const resource = path[0],
      id = path[1],
      method = request.method;
    const u = new URL(request.url);
    if (resource === "session" && method === "GET") {
      const s = await admin();
      return Response.json(
        {
          signedIn: !!s.user,
          admin: s.allowed,
          userId: s.user?.userId ?? null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (method !== "GET") await requireAdmin(request);
    if (
      method !== "GET" &&
      resource !== "uploads" &&
      Number(request.headers.get("content-length")) > 1024 * 1024
    )
      throw new ApiError(413, "BODY_TOO_LARGE", "Request is too large.");
    const db = bindings();
    if (resource === "works") {
      if (method === "GET") {
        const isAdmin = u.searchParams.get("admin") === "1";
        if (isAdmin) await requireAdmin();
        if (id) {
          const row = await db
            .prepare(
              `SELECT * FROM works WHERE (id=? OR slug=?) ${isAdmin ? "" : "AND status='published'"}`,
            )
            .bind(id, id)
            .first<Record<string, unknown>>();
          if (!row) throw new ApiError(404, "NOT_FOUND", "Work not found.");
          return Response.json(decodeWork(row), {
            headers: { "Cache-Control": "no-store" },
          });
        }
        return Response.json(
          await listWorks({
            admin: isAdmin,
            type: u.searchParams.get("type"),
            category: u.searchParams.get("category"),
            featured: u.searchParams.get("featured") === "1",
            q: u.searchParams.get("q"),
            page: u.searchParams.get("page"),
            sort: u.searchParams.get("sort"),
          }),
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      if (method === "DELETE" && id) {
        await db.prepare("DELETE FROM works WHERE id=?").bind(id).run();
        return Response.json({ ok: true });
      }
      if (method === "POST" || (method === "PUT" && id)) {
        const parsed = workSchema.safeParse(await request.json());
        if (!parsed.success)
          throw new ApiError(
            400,
            "VALIDATION",
            parsed.error.issues
              .map((x) => `${x.path.join(".")}: ${x.message}`)
              .join("; "),
          );
        const v = parsed.data;
        if (
          v.categoryId &&
          !(await db
            .prepare("SELECT id FROM categories WHERE id=?")
            .bind(v.categoryId)
            .first())
        )
          throw new ApiError(400, "VALIDATION", "Category no longer exists.");
        for (const file of [
          ...v.attachmentIds,
          ...(v.coverId ? [v.coverId] : []),
        ]) {
          const found = await db
            .prepare("SELECT mime FROM uploads WHERE id=?")
            .bind(file)
            .first<{ mime: string }>();
          if (
            !found ||
            (file === v.coverId && !found.mime.startsWith("image/"))
          )
            throw new ApiError(
              400,
              "VALIDATION",
              "Attachment or cover is invalid.",
            );
        }
        if (method === "PUT") {
          const old = await db
            .prepare("SELECT slug FROM works WHERE id=?")
            .bind(id)
            .first<{ slug: string }>();
          if (old && old.slug !== v.slug)
            throw new ApiError(
              400,
              "STABLE_SLUG",
              "Existing URLs cannot be changed.",
            );
        }
        const now = new Date().toISOString();
        const values = [
          v.type,
          v.title,
          v.slug,
          v.description,
          v.body,
          JSON.stringify(v.tags),
          v.categoryId,
          v.status,
          +v.featured,
          v.type === "video" ? youtubeId(v.youtubeId!) : null,
          v.publication,
          v.publicationDate,
          v.attribution,
          v.externalUrl,
          v.coverId,
          JSON.stringify(v.attachmentIds),
        ];
        if (method === "PUT") {
          const result = await db
            .prepare(
              `UPDATE works SET ${columns.map((x) => x + "=?").join(",")}, updated_at=? WHERE id=?`,
            )
            .bind(...values, now, id)
            .run();
          if (!result.meta.changes)
            throw new ApiError(404, "NOT_FOUND", "Work no longer exists.");
          return Response.json({ id });
        }
        const newId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO works (id,${columns.join(",")},created_at,updated_at) VALUES (${Array(
              columns.length + 3,
            )
              .fill("?")
              .join(",")})`,
          )
          .bind(newId, ...values, now, now)
          .run();
        return Response.json({ id: newId }, { status: 201 });
      }
    }
    if (resource === "categories") {
      if (method === "GET") {
        return Response.json(await listCategories());
      }
      if (method === "DELETE" && id) {
        await db.batch([
          db
            .prepare("UPDATE works SET category_id=NULL WHERE category_id=?")
            .bind(id),
          db.prepare("DELETE FROM categories WHERE id=?").bind(id),
        ]);
        return Response.json({ ok: true });
      }
      if (method === "POST" || (method === "PUT" && id)) {
        const parsed = categorySchema.safeParse(await request.json());
        if (!parsed.success)
          throw new ApiError(
            400,
            "VALIDATION",
            "Both category names and a valid order are required.",
          );
        const v = parsed.data;
        const key = id || crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO categories (id,name_te,name_en,position) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name_te=VALUES(name_te),name_en=VALUES(name_en),position=VALUES(position)",
          )
          .bind(key, v.nameTe, v.nameEn, v.position)
          .run();
        return Response.json({ id: key });
      }
    }
    if (resource === "settings") {
      if (method === "GET") {
        return Response.json(await getSettings());
      }
      if (method === "PUT") {
        const parsed = settingsSchema.safeParse(await request.json());
        if (!parsed.success)
          throw new ApiError(
            400,
            "VALIDATION",
            "Check the email and use HTTPS social links.",
          );
        await db
          .prepare(
            "INSERT INTO settings (id,`value`) VALUES ('site',?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)",
          )
          .bind(JSON.stringify(parsed.data))
          .run();
        return Response.json({ ok: true });
      }
    }
    if (resource === "dashboard" && method === "GET") {
      await requireAdmin();
      const rows = await db
        .prepare(
          "SELECT type,status,count(*) AS count FROM works GROUP BY type,status",
        )
        .all();
      return Response.json(rows.results);
    }
    if (resource === "uploads" && method === "POST") {
      if(cloudStorage())throw new ApiError(400,"DIRECT_UPLOAD_REQUIRED","Use the direct upload flow.");
      if (!env.BUCKET)
        throw new ApiError(
          503,
          "STORAGE_UNAVAILABLE",
          "File storage is not configured.",
        );
      if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
        throw new ApiError(
          413,
          "FILE_TOO_LARGE",
          "Maximum file size is 10 MB.",
        );
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
        throw new ApiError(
          400,
          "INVALID_FILE",
          "Choose a PDF, JPEG, PNG or WebP up to 10 MB.",
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validFile(bytes, file.type))
        throw new ApiError(
          400,
          "INVALID_FILE",
          "The file contents do not match a supported PDF, JPEG, PNG or WebP.",
        );
      const key = crypto.randomUUID();
      await env.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: file.type },
      });
      try {
        await db
          .prepare(
            "INSERT INTO uploads (id,name,mime,size,created_at) VALUES (?,?,?,?,?)",
          )
          .bind(
            key,
            file.name.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 150) ||
              "attachment",
            file.type,
            file.size,
            new Date().toISOString(),
          )
          .run();
      } catch (e) {
        await env.BUCKET.delete(key);
        throw e;
      }
      return Response.json({ id: key, name: file.name }, { status: 201 });
    }
    if (resource === "uploads" && method === "GET" && id) {
      const file = await db
        .prepare("SELECT * FROM uploads WHERE id=?")
        .bind(id)
        .first<{ mime: string; name: string }>();
      if (!file) throw new ApiError(404, "NOT_FOUND", "File not found.");
      const published = await db
        .prepare(
          "SELECT id FROM works WHERE status='published' AND (cover_id=? OR JSON_CONTAINS(works.attachment_ids, JSON_QUOTE(?)))",
        )
        .bind(id, id)
        .first();
      if (!published) await requireAdmin();
      if(cloudStorage())return new Response(null,{status:302,headers:{Location:await downloadUrl(id),"Cache-Control":"private, no-store"}});
      const object = await env.BUCKET?.get(id);
      if (!object) throw new ApiError(404, "NOT_FOUND", "File not found.");
      return new Response(object.body, {
        headers: {
          "Content-Type": file.mime,
          "Content-Disposition": `inline; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    if (resource === "import" && method === "POST") {
      const vars = env as unknown as Record<string, string>;
      if (!vars.YOUTUBE_API_KEY)
        throw new ApiError(
          503,
          "YOUTUBE_KEY_MISSING",
          "Add YOUTUBE_API_KEY to enable channel import. Manual YouTube entry works without a key.",
        );
      const fetchYouTube = async (
        endpoint: string,
        params: Record<string, string>,
      ) => {
        const response = await fetch(
          "https://www.googleapis.com/youtube/v3/" +
            endpoint +
            "?" +
            new URLSearchParams({ ...params, key: vars.YOUTUBE_API_KEY }),
          { signal: AbortSignal.timeout(15000) },
        );
        if (!response.ok)
          throw new ApiError(
            502,
            "YOUTUBE_ERROR",
            "YouTube rejected the request. Check API access, key restrictions and quota.",
          );
        return (await response.json()) as any;
      };
      const channel = await fetchYouTube("channels", {
        part: "contentDetails",
        forHandle: "seshachandracreations1955",
      });
      const playlist =
        channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!playlist)
        throw new ApiError(
          404,
          "CHANNEL_NOT_FOUND",
          "YouTube channel not found.",
        );
      const input = (await request.json()) as { cursor?: string };
      if (input.cursor && !/^[\w=-]{1,300}$/.test(input.cursor))
        throw new ApiError(400, "VALIDATION", "Invalid import cursor.");
      const data = await fetchYouTube("playlistItems", {
        part: "snippet,contentDetails",
        playlistId: playlist,
        maxResults: "50",
        ...(input.cursor ? { pageToken: input.cursor } : {}),
      });
      let imported = 0,
        skipped = 0;
      for (const item of data.items || []) {
        const vid = item.contentDetails?.videoId;
        const s = item.snippet;
        if (
          !vid ||
          !youtubeId(vid) ||
          !s?.title ||
          ["Private video", "Deleted video"].includes(s.title)
        ) {
          skipped++;
          continue;
        }
        const now = new Date().toISOString();
        const result = await db
          .prepare(
            "INSERT IGNORE INTO works (id,slug,type,title,description,youtube_id,status,publication_date,created_at,updated_at) VALUES (?,?,'video',?,?,?,'draft',?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            "youtube-" + vid.toLowerCase(),
            s.title,
            s.description || "",
            vid,
            (item.contentDetails.videoPublishedAt || s.publishedAt || "").slice(
              0,
              10,
            ),
            now,
            now,
          )
          .run();
        if (result.meta.changes) imported++;
        else skipped++;
      }
      return Response.json({
        imported,
        skipped,
        nextCursor: data.nextPageToken || null,
      });
    }
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json(
        { error: "Invalid JSON request.", code: "VALIDATION" },
        { status: 400 },
      );
    return errorResponse(e);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };

