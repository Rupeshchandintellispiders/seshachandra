import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { verifyPassword } from "../lib/password.mjs";
const name = "sc_transfer_test_" + Date.now();
if (!/^sc_transfer_test_[0-9]+$/.test(name))
  throw Error("Unsafe test database name");
const c = await mysql.createConnection(mysqlOptions());
const original = process.env.MYSQL_DATABASE || "seshachandra_creations";
function run(script, args = [], extra = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...extra },
  });
  if (r.status !== 0) throw Error(script + " failed: " + r.stderr + r.stdout);
  return r.stdout;
}
try {
  const [before] = await c.query("SELECT COUNT(*) total FROM works");
  run("scripts/export-content.mjs", ["outputs/test-content-export.json"]);
  const backup = JSON.parse(
    await readFile("outputs/test-content-export.json", "utf8"),
  );
  assert.equal(backup.tables.works.length, before[0].total);
  assert.ok(!backup.tables.admins && !backup.tables.admin_sessions);
  const target = { MYSQL_DATABASE: name, MYSQL_CREATE_DATABASE: "true" };
  run("scripts/db-setup.mjs", [], target);
  run(
    "scripts/import-content.mjs",
    ["outputs/test-content-export.json"],
    target,
  );
  const [rows] = await c.query(
    "SELECT COUNT(*) total FROM `" + name + "`.works",
  );
  assert.equal(rows[0].total, before[0].total);
  const again = spawnSync(
    process.execPath,
    ["scripts/import-content.mjs", "outputs/test-content-export.json"],
    { encoding: "utf8", env: { ...process.env, ...target } },
  );
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /must be empty/);
  const email = "qa-admin@example.test",
    password = crypto.randomUUID() + "!";
  run("scripts/admin-create.mjs", [email], {
    ...target,
    ADMIN_SETUP_PASSWORD: password,
  });
  const [admins] = await c.execute(
    "SELECT * FROM `" + name + "`.admins WHERE email=?",
    [email],
  );
  assert.equal(await verifyPassword(password, admins[0].password_hash), true);
  await c.execute(
    "INSERT INTO `" +
      name +
      "`.admin_sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)",
    ["a".repeat(64), admins[0].id, Date.now() + 100000],
  );
  run("scripts/admin-create.mjs", [email], {
    ...target,
    ADMIN_SETUP_PASSWORD: password + "changed",
  });
  const [sessions] = await c.query(
    "SELECT COUNT(*) total FROM `" + name + "`.admin_sessions",
  );
  assert.equal(sessions[0].total, 0);
  const [after] = await c.query("SELECT COUNT(*) total FROM works");
  assert.equal(after[0].total, before[0].total);
  console.log(
    "PASS: content export/import, duplicate-import refusal, admin creation/reset and session revocation. Original " +
      original +
      " (" +
      before[0].total +
      " works) preserved.",
  );
} finally {
  await c.query("DROP DATABASE IF EXISTS `" + name + "`");
  await c.end();
}
