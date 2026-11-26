import { database } from "@/db/mysql";

/** Largest logo accepted. Logos are stored in the database, so keep them small. */
export const maxLogoBytes = 1024 * 1024;
export const logoMimes = ["image/png", "image/jpeg", "image/webp"];

/**
 * The address of the current logo, or null when none is set. The version in
 * the address changes on every upload, so browsers can cache each version
 * for good and still show a new logo at once.
 */
export async function logoUrl(): Promise<string | null> {
  try {
    const row = await database
      .prepare("SELECT updated_at FROM site_logo WHERE id='site'")
      .first<{ updated_at: number }>();
    return row ? "/site-logo?v=" + Number(row.updated_at) : null;
  } catch {
    // Before migration 0006 runs, the site keeps working without a logo.
    return null;
  }
}
