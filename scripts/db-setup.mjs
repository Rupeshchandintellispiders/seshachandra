import "./check-node.mjs";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = "dist/server/wrangler.json";
if (!existsSync(config)) {
  console.error("Run npm run build first to create the local binding config.");
  process.exit(1);
}
const args = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  config,
  "--persist-to",
  ".wrangler/state",
];
function execute(extra) {
  const r = spawnSync(process.execPath, [...args, ...extra], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr, r.stdout);
    process.exit(r.status || 1);
  }
  return r.stdout;
}
execute([
  "--command",
  "CREATE TABLE IF NOT EXISTS sc_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
]);
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
for (const entry of journal.entries) {
  const name = entry.tag;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("Invalid migration name");
  const result = JSON.parse(
    execute([
      "--json",
      "--command",
      `SELECT name FROM sc_migrations WHERE name='${name}'`,
    ]),
  );
  if (result.some((r) => r.results?.length)) {
    console.log("Already applied:", name);
    continue;
  }
  execute(["--file", `drizzle/${name}.sql`]);
  execute([
    "--command",
    `INSERT INTO sc_migrations VALUES ('${name}',datetime('now'))`,
  ]);
  console.log("Applied:", name);
}
console.log("Local database is ready. Existing content was preserved.");
