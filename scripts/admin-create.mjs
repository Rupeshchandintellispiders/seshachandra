import "./check-node.mjs";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import { hashPassword } from "../lib/password.mjs";
import readline from "node:readline";
import { Writable } from "node:stream";
const email = (process.argv[2] || process.env.ADMIN_SETUP_EMAIL || "")
  .trim()
  .toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  throw Error("Usage: npm run admin:create -- your@email.com");
let password = process.env.ADMIN_SETUP_PASSWORD;
if (!password) {
  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!hidden) process.stdout.write(chunk);
      done();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  const ask = (prompt) =>
    new Promise((resolve) => {
      process.stdout.write(prompt);
      hidden = true;
      rl.question("", (answer) => {
        hidden = false;
        process.stdout.write("\n");
        resolve(answer);
      });
    });
  password = await ask("New admin password (hidden, at least 12 characters): ");
  const confirm = await ask("Repeat password: ");
  rl.close();
  if (password !== confirm) throw Error("Passwords do not match.");
}
if (password.length < 12 || password.length > 128)
  throw Error("Use a password between 12 and 128 characters.");
const c = await mysql.createConnection(mysqlOptions());
try {
  const hash = await hashPassword(password);
  await c.beginTransaction();
  await c.execute(
    "INSERT INTO admins(id,email,password_hash) VALUES(?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),active=1",
    [crypto.randomUUID(), email, hash],
  );
  await c.execute(
    "DELETE s FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE a.email=?",
    [email],
  );
  await c.commit();
  console.log(
    "Admin saved. Previous sessions revoked. Sign in at /admin/login.",
  );
} catch (e) {
  await c.rollback();
  throw e;
} finally {
  await c.end();
}
