import "./check-node.mjs";
import { mysqlOptions } from "../lib/mysql-options.mjs";
import mysql from "mysql2/promise";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import path from "node:path";
if (
  !process.env.S3_BUCKET ||
  !process.env.S3_ENDPOINT ||
  !process.env.S3_ACCESS_KEY_ID ||
  !process.env.S3_SECRET_ACCESS_KEY
)
  throw Error("Set all S3 credentials in the source environment first.");
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const c = await mysql.createConnection(mysqlOptions());
let copied = 0,
  skipped = 0;
try {
  const [rows] = await c.query("SELECT id,mime,size FROM uploads");
  for (const row of rows) {
    if (!/^[a-f0-9-]{36}$/i.test(row.id)) throw Error("Invalid upload ID");
    const bytes = await readFile(
      path.resolve(process.env.UPLOAD_DIRECTORY || "data/uploads", row.id),
    );
    if (bytes.length !== row.size)
      throw Error("Local file size mismatch for " + row.id);
    const key = "files/" + row.id;
    try {
      const existing = await s3.send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      );
      if (existing.ContentLength !== row.size)
        throw Error("Existing object differs: " + key);
      skipped++;
      continue;
    } catch (e) {
      if (e.$metadata?.httpStatusCode !== 404) throw e;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: row.mime,
        CacheControl: "private, no-store",
        ContentDisposition: "inline",
      }),
    );
    copied++;
  }
  console.log({ copied, skipped });
} finally {
  await c.end();
}
