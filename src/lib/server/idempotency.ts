import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { sha256Hex } from "@/lib/utils";

export interface IdempotencyOptions {
  key: string;
  scope: string;
  ttlMs?: number;
  shouldCacheResult?: (result: unknown) => boolean;
}

/**
 * Idempotenci pemrosesan — menjamin sebuah key hanya diproses sekali.
 * Semantik: key = hasil hash dari identitas operasi (mis. paymentRef webhook).
 * Jika key sudah diproses, hasil sebelumnya di-return ulang (replay).
 *
 * Insert-unique dan klaim bersyarat FAILED → PENDING membatasi satu pemilik.
 * Callback harus mengatomikkan efek bisnisnya sendiri (misalnya kunci pembayaran).
 */
export async function withIdempotency<T>(
  opts: IdempotencyOptions,
  run: () => Promise<T>
): Promise<{ result: T; replay: boolean }> {
  const { key, scope, ttlMs = 24 * 60 * 60 * 1000 } = opts;
  const keyHash = await sha256Hex(`${scope}:${key}`);

  const existing = await db
    .select({ status: idempotencyKeys.status, result: idempotencyKeys.result })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, keyHash))
    .limit(1);

  if (existing.length > 0 && existing[0].status === "PROCESSED" && existing[0].result) {
    return { result: existing[0].result as T, replay: true };
  }

  const claimed = await db.insert(idempotencyKeys).values({
    key: keyHash, scope, status: "PENDING", expiresAt: new Date(Date.now() + ttlMs),
  }).onConflictDoNothing().returning({ key: idempotencyKeys.key });
  let owned = claimed.length > 0;
  if (!owned) {
    // A failed attempt may be retried, but only one concurrent caller owns it.
    const retried = await db.update(idempotencyKeys).set({ status: "PENDING", result: null,
      expiresAt: new Date(Date.now() + ttlMs), processedAt: null })
      .where(and(eq(idempotencyKeys.key, keyHash), eq(idempotencyKeys.status, "FAILED")))
      .returning({ key: idempotencyKeys.key });
    owned = retried.length > 0;
  }
  if (!owned) {
    const [after] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, keyHash)).limit(1);
    if (after?.status === "PROCESSED" && after.result !== null) return { result: after.result as T, replay: true };
    throw new AppError("CONFLICT", "Operasi dengan kunci ini sedang diproses.");
  }

  try {
    const result = await run();
    await db
      .update(idempotencyKeys)
      .set({ status: opts.shouldCacheResult?.(result) === false ? "FAILED" : "PROCESSED", result: result as unknown as Record<string, unknown>, processedAt: new Date() })
      .where(eq(idempotencyKeys.key, keyHash));
    return { result, replay: false };
  } catch (err) {
    await db
      .update(idempotencyKeys)
      .set({
        status: "FAILED",
        result: { error: err instanceof Error ? err.message : String(err) },
        processedAt: new Date(),
      })
      .where(eq(idempotencyKeys.key, keyHash));
    throw err;
  }
}

/** Hapus kunci idempotensi basi (dipanggil job maintenance / seed). */
export async function sweepExpiredIdempotencyKeys(before: Date): Promise<number> {
  const res = await db
    .delete(idempotencyKeys)
    .where(and(eq(idempotencyKeys.status, "PENDING"), lt(idempotencyKeys.expiresAt, before)))
    .returning({ id: idempotencyKeys.id });
  return res.length;
}