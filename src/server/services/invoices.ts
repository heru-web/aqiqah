import "server-only";
import { assertBranchAccess } from "@/lib/branch-access";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoiceItems, invoices, orderItems, receivables } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit, type Tx } from "@/lib/server/audit";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";
import { computeBalance } from "@/server/pricing";
import { postJournal, COA } from "@/server/services/journal";

export interface InvoiceSourceOrder {
  id: string;
  branchId: string;
  customerId: string;
  itemsTotal: bigint;
  discountAmount: bigint;
  shippingAmount: bigint;
  rounding: bigint;
  total: bigint;
  paidConfirmed: bigint;
}

/**
 * Issue invoice dari order (dipanggil saat order DIBUAT).
 * Sekaligus: buat receivable & post jurnal SALES:
 *  DR Piutang Usaha — CR Pendapatan Usaha.
 */
export async function issueInvoiceFromOrder(source: InvoiceSourceOrder, actor: AuthUser, exec?: Tx): Promise<string> {
  const runner = exec ?? db;
  const invoiceNumber = await nextSequentialNumber("INV", { pad: 4 }, runner);
  const balance = computeBalance(source.total, source.paidConfirmed);
  const status = balance.balance <= 0n ? "PAID" : balance.paidConfirmed > 0n ? "PARTIAL" : "ISSUED";
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [inv] = await runner
    .insert(invoices)
    .values({
      branchId: source.branchId,
      invoiceNumber,
      orderId: source.id,
      customerId: source.customerId,
      status,
      issueDate: new Date(),
      dueDate,
      itemsTotal: source.itemsTotal,
      discountAmount: source.discountAmount,
      shippingAmount: source.shippingAmount,
      rounding: source.rounding,
      total: source.total,
      totalPaid: source.paidConfirmed,
      balance: balance.balance,
      createdBy: actor.id,
    })
    .returning({ id: invoices.id });

  await runner.insert(receivables).values({
    branchId: source.branchId,
    invoiceId: inv.id,
    customerId: source.customerId,
    amount: source.total,
    settledAmount: source.paidConfirmed,
    balance: balance.balance,
    status: balance.balance <= 0n ? "SETTLED" : source.paidConfirmed > 0n ? "PARTIAL" : "OPEN",
    dueDate,
  });

  await postJournal({
    exec: runner,
    branchId: source.branchId,
    type: "SALES",
    journalDate: new Date(),
    description: `Penjualan ${invoiceNumber} (order ${source.id})`,
    sourceModule: "sales",
    sourceEntityType: "invoice",
    sourceEntityId: inv.id,
    lines: [
      { accountCode: COA.AR, debit: source.total, credit: 0n, referenceType: "invoice" },
      { accountCode: COA.INCOME_SALES, debit: 0n, credit: source.total, referenceType: "invoice" },
    ],
    actor,
  });

  await insertAudit(runner, {
    actor,
    action: "CREATE",
    module: "invoices",
    entityType: "invoice",
    entityId: inv.id,
    after: { invoiceNumber, total: source.total.toString(), status },
  });

  return inv.id;
}

export async function copyOrderItemsToInvoice(invoiceId: string, orderId: string, exec?: Tx): Promise<void> {
  const runner = exec ?? db;
  const items = await runner.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    await runner.insert(invoiceItems).values({
      invoiceId,
      kind: it.kind,
      entityId: it.entityId ?? null,
      variantId: it.variantId ?? null,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    });
  }
}

/**
 * Terapkan pembayaran ke invoice + receivable. Return invoice terbaru.
 * Menolak overpayment (amount > balance).
 */
export async function applyPaymentToInvoice(exec: Tx, invoiceId: string, amount: bigint, actor: AuthUser): Promise<void> {
  const invs = await exec.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1).for("update");
  if (invs.length === 0) throw new NotFoundError("Invoice tidak ditemukan.");
  const inv = invs[0];
  assertBranchAccess(actor, inv.branchId);

  if (inv.status === "VOID") throw new ConflictError("Invoice dibatalkan, tidak bisa dibayar.");
  if (amount <= 0n) throw new ConflictError("Nominal pembayaran harus > 0.");
  if (amount > inv.balance) {
    throw new ConflictError(
      `Pembayaran melebihi sisa tagihan (sisa ${inv.balance}, dibayar ${amount}).`
    );
  }

  const newPaid = inv.totalPaid + amount;
  const status = newPaid >= inv.total ? "PAID" : "PARTIAL";

  await exec
    .update(invoices)
    .set({ totalPaid: newPaid, balance: inv.total - newPaid, status })
    .where(eq(invoices.id, invoiceId));

  const recs = await exec.select().from(receivables).where(eq(receivables.invoiceId, invoiceId)).limit(1);
  if (recs.length > 0) {
    const rec = recs[0];
    const newSettled = rec.settledAmount + amount;
    await exec
      .update(receivables)
      .set({
        settledAmount: newSettled,
        balance: rec.amount - newSettled,
        status: newSettled >= rec.amount ? "SETTLED" : "PARTIAL",
      })
      .where(eq(receivables.id, rec.id));
  }

  await insertAudit(exec, {
    actor,
    action: "UPDATE",
    module: "invoices",
    entityType: "invoice",
    entityId: invoiceId,
    after: { totalPaid: newPaid.toString(), status },
  });
}

export async function getInvoiceDetail(id: string) {
  const inv = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (inv.length === 0) throw new NotFoundError("Invoice tidak ditemukan.");
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return { invoice: inv[0], items };
}

export async function listInvoices(opts: { branchId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const { status, page = 1, pageSize = 20 } = opts;
  const conditions = [];
  if (opts.branchId) conditions.push(eq(invoices.branchId, opts.branchId));
  if (status && status !== "ALL") conditions.push(eq(invoices.status, status as (typeof invoices.$inferSelect)["status"]));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(where);
  return { rows, total: Number(total), page, pageSize };
}

export async function voidInvoice(id: string, actor: AuthUser): Promise<string> {
  const invs = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (invs.length === 0) throw new NotFoundError("Invoice tidak ditemukan.");
  if (invs[0].status === "PAID") throw new ConflictError("Invoice lunas tidak boleh di-void.");
  await db.update(invoices).set({ status: "VOID" }).where(eq(invoices.id, id));
  await insertAudit(db, { actor, action: "DELETE", module: "invoices", entityType: "invoice", entityId: id });
  return id;
}