import { test } from "node:test";
import assert from "node:assert/strict";
import {
  youtubeId,
  workSchema,
  settingsSchema,
  defaultSettings,
  isAllowedAdmin,
  validFile,
} from "../lib/validation.ts";
test("YouTube parsing accepts supported links but rejects hostile hosts and malformed IDs", () => {
  for (const url of [
    "https://youtu.be/abcdefghijk",
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://youtube.com/shorts/abcdefghijk",
    "abcdefghijk",
  ])
    assert.equal(youtubeId(url), "abcdefghijk");
  for (const url of [
    "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "javascript:abcdefghijk",
    "https://evil.test/abcdefghijk",
    "short",
  ])
    assert.equal(youtubeId(url), null);
});
test("Published stories require actual content; drafts may be empty", () => {
  const base = { title: "తెలుగు", slug: "test-story", type: "story" };
  assert.equal(workSchema.safeParse(base).success, true);
  assert.equal(
    workSchema.safeParse({ ...base, status: "published" }).success,
    false,
  );
  assert.equal(
    workSchema.safeParse({ ...base, status: "published", body: "పరీక్ష" })
      .success,
    true,
  );
});
test("Validation rejects impossible dates, unsafe URLs and invalid slugs", () => {
  for (const input of [
    { publicationDate: "2025-02-30" },
    { publicationDate: "2025-99-99" },
    { externalUrl: "javascript:alert(1)" },
    { slug: "../test" },
  ])
    assert.equal(
      workSchema.safeParse({
        title: "test",
        slug: "test",
        type: "book",
        ...input,
      }).success,
      false,
    );
  assert.equal(
    settingsSchema.safeParse({
      ...defaultSettings,
      youtubeUrl: "http://insecure.test",
    }).success,
    false,
  );
});
test("Admin access defaults to deny and development identity never works in production", () => {
  assert.equal(isAllowedAdmin(null, "owner", false), false);
  assert.equal(isAllowedAdmin("stranger", "owner", false), false);
  assert.equal(isAllowedAdmin("owner", "owner,other", false), true);
  assert.equal(isAllowedAdmin("local_seedy", "local_seedy", false), false);
  assert.equal(isAllowedAdmin("local_seedy", "", true), true);
});
test("Upload validation verifies magic bytes and rejects SVG / HTML", () => {
  assert.equal(
    validFile(new TextEncoder().encode("%PDF-1.4"), "application/pdf"),
    true,
  );
  assert.equal(
    validFile(new TextEncoder().encode("<script>"), "application/pdf"),
    false,
  );
  assert.equal(
    validFile(new TextEncoder().encode("<svg/>"), "image/svg+xml"),
    false,
  );
  assert.equal(
    validFile(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    true,
  );
});
