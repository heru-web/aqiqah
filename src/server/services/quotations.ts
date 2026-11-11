import "server-only";
import { resolveBranch } from "@/lib/branch-access";
import { vouchers } from "@/db/schema/sales";

import { and, count, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { customers, quotationItems, quotations } from "@/db/schema";
import { ConflictError, InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";
import { quotationCreateSchema, type QuotationCreateRawInput } from "@/server/schemas";
import { computeTotals } from "@/server/pricing";
import { snapshotPrices } from "@/server/services/products";
import { createOrderFromQuotation } from "@/server/services/orders";

export async function createQuotation(input: QuotationCreateRawInput, actor: AuthUser): Promise<string> {
  const parsed = quotationCreateSchema.parse(input);
  const branchId = resolveBranch(actor, parsed.branchId);
  if (!branchId) throw new ConflictError("Branch belum diatur untuk user.");

  const snapshots = await snapshotPrices(parsed.items, actor);
  const lines = parsed.items.map((item, i) => ({
    item,
    unitPrice: snapshots[i].unitPrice,
    description: snapshots[i].description,
  }));

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.item.quantity, discountBps: l.item.discountBps, isFree: l.item.isFree })),
    { shippingAmount: parsed.shippingAmount, roundingModulus: 0n }
  );

  // Voucher (petunjuk potongan; devisi eksekusi tetap di order → voucher_redemptions)
  let voucherDiscount = 0n;
  if (parsed.voucherCode) {
    const code = parsed.voucherCode.trim().toUpperCase();
    const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code)).limit(1);
    if (!v) throw new NotFoundError("Kode voucher tidak ditemukan.");
    if (!v.isActive) throw new InvalidOperationError("Voucher nonaktif.");
    if (v.startsAt && v.startsAt.getTime() > Date.now()) throw new InvalidOperationError("Voucher belum berlaku.");
    if (v.expiresAt && v.expiresAt.getTime() < Date.now()) throw new InvalidOperationError("Voucher sudah kedaluwarsa.");
    if (v.maxUsage != null && v.usedCount >= v.maxUsage) throw new InvalidOperationError("Kuota voucher habis.");
    if (v.type === "NOMINAL") voucherDiscount = v.nominalAmount > totals.itemsTotal ? totals.itemsTotal : v.nominalAmount;
    if (v.type === "PERCENT") voucherDiscount = (totals.itemsTotal * BigInt(v.percentBps)) / 10000n;
  }

  const quoteNumber = await nextSequentialNumber("QTN", { pad: 4 });
  const [quote] = await db
    .insert(quotations)
    .values({
      branchId,
      quoteNumber,
      customerId: parsed.customerId,
      leadId: parsed.leadId ?? null,
      validUntil: parsed.validUntil,
      status: "DRAFT",
      itemsTotal: totals.itemsTotal,
      discountAmount: totals.discountAmount + voucherDiscount,
      shippingAmount: totals.shippingAmount,
      rounding: totals.rounding,
      total: totals.total - voucherDiscount,
      notes: parsed.notes ?? null,
      terms: parsed.terms ?? null,
      createdBy: actor.id,
    })
    .returning({ id: quotations.id });

  for (const l of lines) {
    await db.insert(quotationItems).values({
      quotationId: quote.id,
      kind: l.item.kind,
      entityId: l.item.entityId ?? null,
      variantId: l.item.variantId ?? null,
      description: l.description,
      quantity: l.item.quantity,
      unitPrice: l.unitPrice,
      discountBps: l.item.discountBps,
      lineTotal: computeLineTotal(l.unitPrice, l.item.quantity, l.item.discountBps),
    });
  }

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "quotations",
    entityType: "quotation",
    entityId: quote.id,
    after: { quoteNumber, total: totals.total.toString() },
  });
  return quote.id;
}

function computeLineTotal(unitPrice: bigint, qty: number, bps: number): bigint {
  const gross = unitPrice * BigInt(qty);
  if (bps <= 0) return gross;
  return gross - (gross * BigInt(bps)) / 10000n;
}

export async function setQuotationStatus(id: string, status: "SENT" | "ACCEPTED" | "REJECTED" | "VOID" | "EXPIRED", actor: AuthUser): Promise<string> {
  const quote = await requireQuotation(id);
  if ((quote.status === "VOID" || quote.status === "ACCEPTED") && status !== "VOID") {
    throw new InvalidOperationError(`Penawaran ${quote.status} tidak bisa diubah statusnya.`);
  }
  const rows = await db.update(quotations).set({ status }).where(eq(quotations.id, id)).returning({ id: quotations.id });
  await insertAudit(db, {
    actor,
    action: "TRANSITION",
    module: "quotations",
    entityType: "quotation",
    entityId: id,
    before: { status: quote.status },
    after: { status },
  });
  return rows[0].id;
}

/** Terima penawaran → buat order (harga snapshot dipakai ulang). */
export async function acceptQuotationAndCreateOrder(id: string, actor: AuthUser): Promise<string> {
  const quote = await requireQuotation(id);
  if (quote.status !== "SENT" && quote.status !== "DRAFT") {
    throw new InvalidOperationError(`Penawaran dengan status ${quote.status} tidak bisa diterima.`);
  }
  if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
    await setQuotationStatus(id, "EXPIRED", actor);
    throw new InvalidOperationError("Penawaran sudah kedaluwarsa.");
  }

  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));

  const orderId = await createOrderFromQuotation({
    quoteId: id,
    customerId: quote.customerId,
    branchId: quote.branchId,
    actor,
    items: items.map((it) => ({
      kind: it.kind,
      entityId: it.entityId ?? undefined,
      variantId: it.variantId ?? undefined,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountBps: it.discountBps,
      isFree: false,
    })),
    shippingAmount: quote.shippingAmount,
    total: quote.total,
    rounding: quote.rounding,
    itemsTotal: quote.itemsTotal,
    discountAmount: quote.discountAmount,
  });

  await setQuotationStatus(id, "ACCEPTED", actor);
  return orderId;
}

/** Maintenance: tandai penawaran SENT yang lewat masa berlaku. */
export async function expireStaleQuotations(): Promise<number> {
  const rows = await db
    .select({ id: quotations.id, validUntil: quotations.validUntil })
    .from(quotations)
    .where(and(eq(quotations.status, "SENT"), lt(quotations.validUntil, new Date())));
  for (const r of rows) {
    await db.update(quotations).set({ status: "EXPIRED" }).where(eq(quotations.id, r.id));
  }
  return rows.length;
}

export async function listQuotations(opts: { branchId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const { status, page = 1, pageSize = 20 } = opts;
  const branchId = opts.branchId ?? undefined;
  const conditions = [];
  if (branchId) conditions.push(eq(quotations.branchId, branchId));
  if (status && status !== "ALL") conditions.push(eq(quotations.status, status));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      status: quotations.status,
      validUntil: quotations.validUntil,
      total: quotations.total,
      createdAt: quotations.createdAt,
      customerName: customers.name,
      customerCode: customers.code,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(where)
    .orderBy(desc(quotations.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ count: total }] = await db.select({ count: count() }).from(quotations).where(where);
  return { rows, total: Number(total), page, pageSize };
}

export async function getQuotationDetail(id: string) {
  const quote = await requireQuotation(id);
  const [customer, items] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, quote.customerId)).limit(1),
    db.select().from(quotationItems).where(eq(quotationItems.quotationId, id)),
  ]);
  return { quotation: quote, customer: customer[0], items };
}

export async function requireQuotation(id: string) {
  const row = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Penawaran tidak ditemukan.");
  return row[0];
}