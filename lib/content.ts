// Server-side content queries shared by server-rendered pages and the API.
import { cookies } from "next/headers";
import { bindings, decodeWork } from "./server";
import {
  defaultSettings,
  type Category,
  type Settings,
  type Work,
} from "./validation";

export const pageSize = 12;
export type WorkResults = {
  items: Work[];
  total: number;
  page: number;
  pages: number;
};
export type WorkQuery = {
  admin?: boolean;
  type?: string | null;
  category?: string | null;
  featured?: boolean;
  q?: string | null;
  page?: number | string | null;
  sort?: string | null;
};

export async function listWorks(query: WorkQuery = {}): Promise<WorkResults> {
  const where: string[] = query.admin ? [] : ["status='published'"];
  const args: unknown[] = [];
  if (query.type) {
    where.push("type=?");
    args.push(query.type);
  }
  if (query.category) {
    where.push("category_id=?");
    args.push(query.category);
  }
  if (query.featured) where.push("featured=1");
  if (query.q) {
    where.push(
      "(title LIKE ? ESCAPE '\\\\' OR description LIKE ? ESCAPE '\\\\' OR tags LIKE ? ESCAPE '\\\\')",
    );
    const q = "%" + query.q.slice(0, 200).replace(/[\\%_]/g, "\\$&") + "%";
    args.push(q, q, q);
  }
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const sort =
    query.sort === "oldest"
      ? "created_at ASC"
      : query.sort === "title"
        ? "title ASC"
        : "created_at DESC";
  const db = bindings();
  const [count, rows] = await Promise.all([
    db
      .prepare(`SELECT count(*) AS total FROM works ${clause}`)
      .bind(...args)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT * FROM works ${clause} ORDER BY ${sort}, id LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, (page - 1) * pageSize)
      .all<Record<string, unknown>>(),
  ]);
  const total = Number(count?.total || 0);
  return {
    items: rows.results.map((row) => decodeWork(row) as Work),
    total,
    page,
    pages: Math.ceil(total / pageSize),
  };
}

export async function listCategories(): Promise<Category[]> {
  const rows = await bindings()
    .prepare(
      "SELECT id,name_te AS nameTe,name_en AS nameEn,position FROM categories ORDER BY position,name_en",
    )
    .all<Category>();
  return rows.results;
}

export async function getSettings(): Promise<Settings> {
  const row = await bindings()
    .prepare("SELECT `value` FROM settings WHERE id='site'")
    .first<{ value: string }>();
  return row ? { ...defaultSettings, ...JSON.parse(row.value) } : defaultSettings;
}

export const languageCookie = "sc-language";
export async function currentLanguage(): Promise<"te" | "en"> {
  return (await cookies()).get(languageCookie)?.value === "en" ? "en" : "te";
}

/** One value from a searchParams entry, ignoring repeated keys. */
export function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) || "";
}
