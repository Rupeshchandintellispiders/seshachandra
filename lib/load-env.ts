import { loadEnvFile } from "node:process";
if (!process.env.VERCEL) {
  try {
    loadEnvFile(".env");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
