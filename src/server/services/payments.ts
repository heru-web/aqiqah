import "server-only";
import { assertBranchAccess, resolveBranch } from "@/lib/branch-access";
import { assertResourceAccess } from "@/lib/server/resource-access";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, invoices } from "@/db/schema";
import { ConflictError, InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit, type Tx } from "@/lib/server/audit";
import { createInAppNotification } from "@/lib/server/notifications";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";
import { paymentConfirmSchema, paymentRegisterSchema, type PaymentRegisterRawInput } from "@/server/schemas";
import { computeBalance } from "@/server/pricing";
import { applyPaymentToInvoice } from "@/server/services/invoices";
import { postJournal, COA } from "@/server/services/journal";

/** Daftarkan pembayaran (dari CRUD / wizard / BSI VA). */
export async function registerPayment(input: PaymentRegisterRawInput, actor: AuthUser, opts: { skipJournal?: boolean; exec?: Tx } = {}): Promise<string> {
  const parsed = paymentRegisterSchema.parse(input);
  const branchId = resolveBranch(actor, parsed.branchId);
  const runner = opts.exec ?? db;
  if (parsed.invoiceId) {
    const [invoice] = await runner.select().from(invoices).where(eq(invoices.id, parsed.invoiceId)).limit(1);
    if (!invoice) throw new NotFoundError("Tagihan tidak ditemukan.");
    if ((parsed.orderId && parsed.orderId !== invoice.orderId) || (parsed.customerId && parsed.customerId !== invoice.customerId)) throw new ConflictError("Tagihan, pesanan, dan pelanggan tidak sesuai.");
    parsed.orderId = invoice.orderId ?? undefined;
    parsed.customerId = invoice.customerId;
  } else if (parsed.orderId) {
    const [order] = await runner.select().from(orders).where(eq(orders.id, parsed.orderId)).limit(1);
    if (!order) throw new NotFoundError("Pesanan tidak ditemukan.");
    if (parsed.customerId && parsed.customerId !== order.customerId) throw new ConflictError("Pelanggan tidak sesuai pesanan.");
    parsed.customerId = order.customerId;
    const [invoice] = await runner.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1);
    if (invoice) parsed.invoiceId = invoice.id;
  }

  for (const [resource, id] of [["order", parsed.orderId], ["invoice", parsed.invoiceId], ["customer", parsed.customerId]] as const) {
    if (id) await assertResourceAccess(resource, id, { ...actor, branchId }, runner);
  }
  if (!branchId) throw new ConflictError("Branch belum diatur untuk user.");

  const paymentNumber = await nextSequentialNumber("PMT", { pad: 4 }, runner);
  const [pay] = await runner
    .insert(payments)
    .values({
      branchId,
      paymentNumber,
      invoiceId: parsed.invoiceId ?? null,
      orderId: parsed.orderId ?? null,
      customerId: parsed.customerId ?? null,
      amount: parsed.amount,
      method: parsed.method,
      provider: parsed.provider ?? null,
      providerRef: parsed.providerRef ?? null,
      bankFrom: parsed.bankFrom ?? null,
      bankTo: parsed.bankTo ?? null,
      senderName: parsed.senderName ?? null,
      notes: parsed.notes ?? null,
      status: "PENDING",
      createdBy: actor.id,
    })
    .returning({ id: payments.id });

  await insertAudit(runner, {
    actor,
    action: "CREATE",
    module: "payments",
    entityType: "payment",
    entityId: pay.id,
    after: { paymentNumber, amount: parsed.amount.toString(), method: parsed.method },
  });

  if (parsed.confirmNow && !opts.skipJournal) {
    await confirmPayment({ paymentId: pay.id, status: "CONFIRMED" }, actor, opts.exec);
  }
  return pay.id;
}

/**
 * Konfirmasi pembayaran (manual / webhook BSI VA yang sudah valid).
 * Atomic: payment → invoice → receivable → order → jurnal RECEIPT.
 * Idempoten: pembayaran CONFIRMED tidak diproses dua kali.
 */
export async function confirmPayment(input: { paymentId: string; status: "CONFIRMED" | "FAILED"; notes?: string }, actor: AuthUser, exec?: Tx): Promise<string> {
  const parsed = paymentConfirmSchema.parse(input);

  const run = async (tx: Tx) => {
    const pays = await tx.select().from(payments).where(eq(payments.id, parsed.paymentId)).limit(1).for("update");
    if (pays.length === 0) throw new NotFoundError("Pembayaran tidak ditemukan.");
    const pay = pays[0];
    assertBranchAccess(actor, pay.branchId);

    if (pay.status !== "PENDING") {
      // idempoten: sudah diproses → kembalikan
      return pay.id;
    }

    await tx
      .update(payments)
      .set({
        status: parsed.status,
        paidAt: parsed.status === "CONFIRMED" ? new Date() : null,
        notes: parsed.notes ?? pay.notes,
        receivedBy: actor.id,
        reconciliationStatus: "MATCHED",
      })
      .where(eq(payments.id, parsed.paymentId));

    if (parsed.status === "FAILED") {
      await insertAudit(tx, {
        actor,
        action: "UPDATE",
        module: "payments",
        entityType: "payment",
        entityId: pay.id,
        after: { status: "FAILED" },
      });
      return pay.id;
    }

    // ---- CONFIRMED ----
    if (pay.amount <= 0n) throw new InvalidOperationError("Nominal pembayaran harus > 0.");

    if (pay.invoiceId) {
      await applyPaymentToInvoice(tx, pay.invoiceId, pay.amount, actor);
    }

    if (pay.orderId) {
      const ords = await tx.select().from(orders).where(eq(orders.id, pay.orderId)).limit(1).for("update");
      if (ords.length === 0) throw new NotFoundError("Order tidak ditemukan.");
      const order = ords[0];
      assertBranchAccess(actor, order.branchId);
      if (order.status === "CANCELLED") throw new InvalidOperationError("Pesanan dibatalkan.");
      const newPaid = order.paidConfirmed + pay.amount;
      if (newPaid > order.total) throw new InvalidOperationError("Pembayaran melebihi sisa pesanan.");
      const bal = computeBalance(order.total, newPaid);
      await tx
        .update(orders)
        .set({ paidConfirmed: newPaid, balance: bal.balance })
        .where(eq(orders.id, order.id));
    }

    // Jurnal RECEIPT: DR Kas/Bank — CR Piutang Usaha
    const accountCode = pay.method === "CASH" ? COA.CASH : COA.BANK;
    await postJournal({
      exec: tx,
      branchId: pay.branchId,
      type: "RECEIPT",
      journalDate: pay.paidAt ?? new Date(),
      description: `Penerimaan ${pay.paymentNumber} (${pay.method})`,
      sourceModule: "payments",
      sourceEntityType: "payment",
      sourceEntityId: pay.id,
      lines: [
        { accountCode, debit: pay.amount, credit: 0n, referenceType: "payment" },
        { accountCode: COA.AR, debit: 0n, credit: pay.amount, referenceType: "payment" },
      ],
      actor,
    });

    await insertAudit(tx, {
      actor,
      action: "TRANSITION",
      module: "payments",
      entityType: "payment",
      entityId: pay.id,
      before: { status: "PENDING" },
      after: { status: "CONFIRMED", amount: pay.amount.toString(), method: pay.method },
    });

    // Notifikasi in-app untuk tim (kanal eksternal disediakan oleh adapter).
    if (pay.customerId) {
      await createInAppNotification({
        userId: null,
        branchId: pay.branchId,
        title: `Pembayaran ${pay.paymentNumber} dikonfirmasi`,
        body: `Rp ${pay.amount.toLocaleString("id-ID")} diterima.`,
        data: { paymentId: pay.id },
      }, tx);
    }

    return pay.id;
  };
  return exec ? run(exec) : db.transaction(run);
}

export async function listPayments(opts: { branchId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const { status, page = 1, pageSize = 20 } = opts;
  const conditions = [];
  if (opts.branchId) conditions.push(eq(payments.branchId, opts.branchId));
  if (status && status !== "ALL") conditions.push(eq(payments.status, status as (typeof payments.$inferSelect)["status"]));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(payments)
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(payments).where(where);
  return { rows, total: Number(total), page, pageSize };
}

export async function requirePayment(id: string) {
  const row = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Pembayaran tidak ditemukan.");
  return row[0];
}