import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, webhookEvents, users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { hmacSha256, timingSafeEqual } from "@/lib/server/crypto";
import { withIdempotency } from "@/lib/server/idempotency";
import { bsiVaCallbackSchema, type BsiVaCallbackInput } from "@/server/schemas";
import { confirmPayment } from "@/server/services/payments";

/**
 * Handler BSI VA callback — 4 langkah PRD:
 * 1) Validasi Signature HMAC API BSI
 * 2) Rekonsiliasi Otomatis Piutang
 * 3) Auto-Posting Jurnal Akuntansi Syariah
 * 4) Kuitansi WA & Dispatch RPH Otomatis (kanal notifikasi)
 *
 * Idempoten per (transactionId/reference). Hanya status PAID yang
 * menghasilkan pembayaran terkonfirmasi.
 */
export async function handleBsiVaCallback(payload: BsiVaCallbackInput, signature?: string, rawBody?: string): Promise<{ ok: boolean; reason?: string }> {
  // (1) Verifikasi signature
  const secret = process.env.BSI_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError("WEBHOOK_INVALID_SIGNATURE", "BSI_WEBHOOK_SECRET belum dikonfigurasi.", { expose: false });
  }
  if (!signature) {
    throw new AppError("WEBHOOK_INVALID_SIGNATURE", "Header signature hilang.", { expose: false });
  }

  const bodyForSigning = rawBody ?? JSON.stringify(payload);
  const expected = hmacSha256(secret, bodyForSigning);
  if (!timingSafeEqual(signature, expected)) {
    throw new AppError("WEBHOOK_INVALID_SIGNATURE", "Signature BSI tidak valid.", { expose: false });
  }

  const parsed = bsiVaCallbackSchema.parse(payload);
  const eventKey = parsed.transactionId ?? `${parsed.reference}-${parsed.paidAt ?? "now"}`;
  const key = `bsi-va:${eventKey}:${parsed.status}`;

  // Persist event mentah (audit webhook)
  const [evt] = await db
    .insert(webhookEvents)
    .values({
      provider: "BSI_VA",
      eventType: "PAYMENT_CALLBACK",
      providerEventId: eventKey,
      payload: JSON.stringify(parsed),
      signatureHash: signature,
      status: "RECEIVED",
    })
    .onConflictDoNothing()
    .returning();

  const outcome = await withIdempotency({ key, scope: "bsi-webhook", shouldCacheResult: (result) => (result as { ok: boolean }).ok }, async () => {
    if (parsed.status !== "PAID") {
      if (evt) {
        await db.update(webhookEvents).set({ status: "IGNORED" }).where(eq(webhookEvents.id, evt.id));
      }
      return { ok: false, reason: "STATUS_NOT_PAID" };
    }

    // (2) Rekonsiliasi: cocokkan dengan payment PENDING ber-providerRef VA
    const pending = await db
      .select()
      .from(payments)
      .where(eq(payments.providerRef, parsed.reference))
      .limit(1);
    if (pending.length === 0) {
      return { ok: false, reason: "PAYMENT_NOT_FOUND" };
    }

    const amount = typeof parsed.amount === "bigint" ? parsed.amount : BigInt(String(parsed.amount));
    if (amount !== pending[0].amount) {
      return { ok: false, reason: "AMOUNT_MISMATCH" };
    }

    // (3) Konfirmasi → jurnal (POSTED otomatis) + (4) notifikasi
    await confirmPayment(
      { paymentId: pending[0].id, status: "CONFIRMED", notes: `Webhook BSI VA ${parsed.transactionId ?? parsed.reference}` },
      await systemActor()
    );

    return { ok: true };
  });

  await db.update(webhookEvents).set({ status: outcome.result.ok ? "PROCESSED" : "FAILED", processedAt: new Date() }).where(eq(webhookEvents.providerEventId, eventKey));
  return outcome.result;
}

async function systemActor() {
  await db.insert(users).values({ id: "00000000-0000-0000-0000-000000000000", email: "system@madani.local", name: "System BSI VA", passwordHash: "!disabled-system-account", isActive: false }).onConflictDoNothing();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    email: "system@madani.local",
    name: "System BSI VA",
    branchId: null,
    roles: ["system"],
    permissions: ["*"],
  };
}