import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/errors";

export interface StorageDriver {
  /** Simpan file, kembalikan key yang dipakai. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** URL publik / suspense singkat untuk GET. */
  getSignedUrl(key: string, expiresInSec?: number): Promise<string>;
  /** URL presigned PUT agar klien bisa upload langsung (avoid proxy besar). */
  getUploadUrl(key: string, contentType: string, expiresInSec?: number): Promise<string>;
}

export function objectKey(prefix: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}/${date}/${randomId()}-${safeName}`;
}

function randomId(): string {
  return randomBytes(16).toString("hex");
}

class LocalStorage implements StorageDriver {
  private base: string;

  constructor(base: string) {
    this.base = base;
  }

  private resolve(key: string): string {
    return join(this.base, key);
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    const target = this.resolve(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return key;
  }

  async getSignedUrl(key: string, _expiresInSec?: number): Promise<string> {
    const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
    // dipakai saat dipanggil server-side; file mungkin tidak bisa diakses publik.
    return new BlobProbe(origin, key).url();
  }

  async getUploadUrl(_key: string, _contentType: string, _expiresInSec?: number): Promise<string> {
    throw new AppError("INVALID_OPERATION", "Upload langsung tidak tersedia dengan storage lokal.");
  }
}

class BlobProbe {
  constructor(private origin: string, private key: string) {}
  url(): string {
    return `${this.origin}/storage/${this.key}`;
  }
}

class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor(opts: { endpoint?: string; region?: string; bucket: string; accessKey?: string; secretKey?: string; forcePathStyle?: boolean }) {
    this.bucket = opts.bucket;
    this.client = new S3Client({
      region: opts.region ?? "auto",
      endpoint: opts.endpoint || undefined,
      forcePathStyle: opts.forcePathStyle ?? true,
      credentials:
        opts.accessKey && opts.secretKey
          ? { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey }
          : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
    return key;
  }

  async getSignedUrl(key: string, expiresInSec = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSec,
    });
  }

  async getUploadUrl(key: string, contentType: string, expiresInSec = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSec }
    );
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const kind = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();

  if (kind === "local") {
    const base = process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), ".data", "storage");
    driver = new LocalStorage(base);
    return driver;
  }

  if (kind === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new AppError("INVALID_OPERATION", "S3_BUCKET belum di-set.", { expose: false });
    driver = new S3Storage({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      bucket,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    });
    return driver;
  }
  throw new AppError("INVALID_OPERATION", `STORAGE_DRIVER tidak dikenal: ${kind}`, { expose: false });
}

/** Helper: jamin direktori temp berhasil dibuat (untuk upload multipart kecil). */
export async function tempUploadDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ma3-up-"));
}