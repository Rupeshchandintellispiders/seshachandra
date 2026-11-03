import { z } from "zod";
export function youtubeId(value: string): string | null {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    let id: string | null = null;
    if (h === "youtu.be") id = u.pathname.split("/")[1];
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(h)
    )
      id =
        u.searchParams.get("v") ||
        (/^\/(shorts|embed|live)\//.test(u.pathname)
          ? u.pathname.split("/")[2]
          : null);
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
const url = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      (() => {
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Use an https:// URL",
  );
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use a valid date",
  );
export const workSchema = z
  .object({
    type: z.enum(["video", "story", "book"]),
    title: z.string().trim().min(1).max(240),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180),
    description: z.string().max(6000).default(""),
    body: z.string().max(200000).default(""),
    tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    categoryId: z.string().nullable().default(null),
    status: z.enum(["draft", "published"]).default("draft"),
    featured: z.boolean().default(false),
    youtubeId: z.string().nullable().default(null),
    publication: z.string().max(300).default(""),
    publicationDate: date.default(""),
    attribution: z.string().max(1000).default(""),
    externalUrl: url.default(""),
    coverId: z.string().uuid().nullable().default(null),
    attachmentIds: z.array(z.string().uuid()).max(12).default([]),
  })
  .superRefine((v, c) => {
    if (v.type === "video" && (!v.youtubeId || !youtubeId(v.youtubeId)))
      c.addIssue({
        code: "custom",
        path: ["youtubeId"],
        message: "Enter a valid YouTube URL or video ID",
      });
    if (
      v.type === "story" &&
      v.status === "published" &&
      !v.body.trim() &&
      !v.attachmentIds.length
    )
      c.addIssue({
        code: "custom",
        path: ["body"],
        message: "A published story needs text or an attachment",
      });
  });
export const categorySchema = z.object({
  nameTe: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  position: z.number().int().min(0).max(10000),
});
export const settingsSchema = z.object({
  aboutTe: z.string().max(20000),
  aboutEn: z.string().max(20000),
  email: z.union([z.literal(""), z.string().email()]),
  phone: z.string().max(50),
  youtubeUrl: url,
  instagramUrl: url,
  facebookUrl: url,
});
export const defaultSettings = {
  aboutTe: "",
  aboutEn: "",
  email: "",
  phone: "",
  youtubeUrl: "https://youtube.com/@seshachandracreations1955",
  instagramUrl: "",
  facebookUrl: "",
};
export type WorkInput = z.infer<typeof workSchema>;
export type Work = WorkInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
export type Category = z.infer<typeof categorySchema> & { id: string };
export type Settings = typeof defaultSettings;
export function isAllowedAdmin(
  id: string | null,
  allowlist: string,
  local: boolean,
) {
  return (
    !!id &&
    (id === "local_seedy"
      ? local
      : allowlist
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .includes(id))
  );
}
export function validFile(bytes: Uint8Array, mime: string) {
  return mime === "application/pdf"
    ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    : mime === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/webp"
          ? new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
          : false;
}
