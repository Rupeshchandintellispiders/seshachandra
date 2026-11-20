import "./check-node.mjs";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { readFile } from "node:fs/promises";
const filename = process.argv[2];
if (!filename)
  throw Error("Usage: npm run db:import -- outputs/content-export.json");
const backup = JSON.parse(await readFile(filename, "utf8"));
if (backup.format !== 1 || !backup.tables)
  throw Error("Unsupported export format.");
const c = await mysql.createConnection(mysqlOptions());
try {
  await c.beginTransaction();
  for (const table of ["categories", "settings", "uploads", "works"]) {
    const [count] = await c.query(
      "SELECT COUNT(*) AS total FROM `" + table + "`",
    );
    if (count[0].total)
      throw Error(
        "Target content tables must be empty. Existing data was preserved.",
      );
  }
  for (const table of ["categories", "settings", "uploads", "works"]) {
    const [schema] = await c.query("SHOW COLUMNS FROM `" + table + "`");
    const columns = schema.map((row) => row.Field);
    const rows = backup.tables[table];
    if (!Array.isArray(rows)) throw Error("Missing export table: " + table);
    for (const row of rows) {
      if (Object.keys(row).some((key) => !columns.includes(key)))
        throw Error("Unexpected column in " + table);
      await c.execute(
        "INSERT INTO `" +
          table +
          "` (" +
          columns.map((v) => "`" + v + "`").join(",") +
          ") VALUES (" +
          columns.map(() => "?").join(",") +
          ")",
        columns.map((column) => row[column] ?? null),
      );
    }
  }
  await c.commit();
  console.log(
    "Imported content successfully. Admin accounts and sessions were not changed.",
  );
} catch (e) {
  await c.rollback();
  throw e;
} finally {
  await c.end();
}
