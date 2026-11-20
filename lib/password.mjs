import { scrypt as rawScrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(rawScrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  const [kind, salt, hash] = encoded.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
