import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  nameTe: text("name_te").notNull(),
  nameEn: text("name_en").notNull(),
  position: integer("position").notNull().default(0),
});
export const works = sqliteTable("works", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  body: text("body").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("draft"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  youtubeId: text("youtube_id").unique(),
  publication: text("publication").notNull().default(""),
  publicationDate: text("publication_date").notNull().default(""),
  attribution: text("attribution").notNull().default(""),
  externalUrl: text("external_url").notNull().default(""),
  coverId: text("cover_id"),
  attachmentIds: text("attachment_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
});
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});
