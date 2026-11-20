import "./load-env";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
export const maxFileSize = 10 * 1024 * 1024;
export const allowedMimes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export function cloudStorage() {
  const enabled = !!process.env.S3_BUCKET;
  if (!enabled && (process.env.VERCEL || process.env.NODE_ENV === "production"))
    throw Error("Configure private S3 storage before uploading on production.");
  return enabled;
}
let client: S3Client | undefined;
function s3() {
  if (
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  )
    throw Error("S3 storage credentials are incomplete.");
  const endpoint = new URL(process.env.S3_ENDPOINT);
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:")
    throw Error("Production storage requires HTTPS.");
  return (client ??= new S3Client({
    endpoint: endpoint.href,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }));
}
const bucket = () => process.env.S3_BUCKET!;
function key(id: string, staging = false) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw Error("Invalid file identifier");
  return (staging ? "staging/" : "files/") + id;
}
export async function presignUpload(id: string, mime: string) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key(id, true),
      ContentType: mime,
    }),
    { expiresIn: 120 },
  );
}
export async function stagedBytes(id: string, size: number) {
  const head = await s3().send(
    new HeadObjectCommand({ Bucket: bucket(), Key: key(id, true) }),
  );
  if (head.ContentLength !== size || size > maxFileSize)
    throw Error("Uploaded size differs from expected size.");
  const object = await s3().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key(id, true),
      Range: `bytes=0-${maxFileSize}`,
    }),
  );
  const bytes = await object.Body!.transformToByteArray();
  if (bytes.byteLength !== size) throw Error("Invalid file size.");
  return bytes;
}
export async function removeStaged(id: string) {
  await s3().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key(id, true) }),
  );
}
export async function downloadUrl(id: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key(id),
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 60 },
  );
}
const directory = () =>
  path.resolve(process.env.UPLOAD_DIRECTORY || "data/uploads");
function filename(id: string) {
  key(id);
  return path.join(directory(), id);
}
export const storage = {
  async put(
    id: string,
    bytes: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ) {
    if (cloudStorage()) {
      await s3().send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key(id),
          Body: bytes,
          ContentType:
            options?.httpMetadata?.contentType || "application/octet-stream",
          ContentDisposition: "inline",
          CacheControl: "private, no-store",
        }),
      );
    } else {
      await mkdir(directory(), { recursive: true });
      await writeFile(filename(id), bytes);
    }
  },
  async get(id: string) {
    if (cloudStorage()) throw Error("Use a signed download URL.");
    try {
      return { body: new Uint8Array(await readFile(filename(id))) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  async delete(id: string) {
    if (cloudStorage())
      await s3().send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: key(id) }),
      );
    else
      await unlink(filename(id)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
  },
};
