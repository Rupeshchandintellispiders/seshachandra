import { loadEnvFile } from "node:process";
if (!process.env.VERCEL) {
  try {
    loadEnvFile(".env");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
export function mysqlOptions() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (process.env.VERCEL && local)
    throw Error("Vercel needs a remote MYSQL_HOST.");
  const tls = process.env.MYSQL_SSL === "true" || !local;
  return {
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "seshachandra_creations",
    charset: "utf8mb4",
    connectTimeout: 10000,
    ...(tls
      ? {
          ssl: {
            rejectUnauthorized: true,
            verifyIdentity: true,
            ...(process.env.MYSQL_SSL_CA
              ? { ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, "\n") }
              : {}),
          },
        }
      : {}),
  };
}
