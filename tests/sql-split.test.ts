import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { splitSql } from "../scripts/sql-split.mjs";

// A literal backslash, built here so editors and shells cannot alter it.
const BS = String.fromCharCode(92);

test("Semicolons inside strings, identifiers and comments do not split statements", () => {
  const escaped = "UPDATE t SET v='it''s;' WHERE w='x" + BS + "';y'";
  const sql = [
    "INSERT INTO t VALUES ('a;b', \"c;d\", `e;f`);",
    escaped + ";",
    "-- comment; with semicolon",
    "/* block; comment */ DELETE FROM t;",
    "# only a comment;",
  ].join("\n");
  assert.deepEqual(splitSql(sql), [
    "INSERT INTO t VALUES ('a;b', \"c;d\", `e;f`)",
    escaped,
    "-- comment; with semicolon\n/* block; comment */ DELETE FROM t",
  ]);
});

test("Existing migrations split exactly as before, so recorded progress stays valid", () => {
  for (const file of readdirSync("migrations/mysql")) {
    const sql = readFileSync("migrations/mysql/" + file, "utf8");
    const before = sql.split(";").map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(splitSql(sql), before, file);
  }
});
