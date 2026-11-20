import "./check-node.mjs";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const output = process.argv[2] || "outputs/content-export.json";
const c = await mysql.createConnection(mysqlOptions());
try {
  await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await c.beginTransaction();
  const tables = {};
  for (const table of ["categories", "settings", "uploads", "works"]) {
    const [rows] = await c.query("SELECT * FROM `" + table + "`");
    tables[table] = rows;
  }
  await c.commit();
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      { format: 1, exportedAt: new Date().toISOString(), tables },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log("Exported content only (no passwords or sessions):", output);
  console.log("Works:", tables.works.length, "Uploads:", tables.uploads.length);
} finally {
  await c.end();
}
