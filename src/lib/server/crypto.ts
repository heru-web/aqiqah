import "server-only";
import { createHash, createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

/** HMAC-SHA256 hex untuk verifikasi signature webhook. */
export function hmacSha256(secret: string, payload: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return nodeTimingSafeEqual(createHash("sha256").update(ba).digest(), createHash("sha256").update(bb).digest());
}