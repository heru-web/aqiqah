import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, sql as connection } from "@/db";
import { accounts, branches, customers, employees, invoices, journals, notifications, orders, packageItems, packages, payments, payrollLines, payrollRuns, productionBatches, products, users, inventoryItems, inventoryLots, deliveryTasks,  } from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";
import { createOrder } from "@/server/services/orders";
import { confirmPayment } from "@/server/services/payments";
import { createInventoryItem, adjustStock, finalizePayrollRun, updatePayrollLine, advanceProdStage, setDeliveryStatus, listInventoryItems } from "@/server/services/erp";
import { previewOrderPricing } from "@/server/services/order-pricing";
import { listInbox, markRead } from "@/server/services/notifications";
import { withIdempotency } from "@/lib/server/idempotency";
import { handleBsiVaCallback } from "@/server/services/bsi-webhook";
import { hmacSha256 } from "@/lib/server/crypto";
import { FORMULAS } from "@/server/services/kpi-formulas";

// These tests write financial fixtures; opt in only with a dedicated local test database.
const enabled = process.env.REPAIR_DB_TESTS === "1" && /(?:localhost|127\.0\.0\.1):55432\/madani_repair/.test(process.env.DATABASE_URL ?? "");
const tag = `repair-${randomUUID().slice(0, 8)}`;
let actor: AuthUser;
let other: AuthUser;
let customerId: string;
let orderId: string;
let invoiceId: string;

describe.skipIf(!enabled)("regresi dengan PostgreSQL terisolasi", () => {
  beforeAll(async () => {
    const [a, b] = await db.insert(branches).values([{ code: tag, name: tag }, { code: tag + "b", name: tag + "b" }]).returning();
    const [u, v] = await db.insert(users).values([{ email: `${tag}@example.test`, name: tag, passwordHash: "!test", branchId: a.id }, { email: `${tag}b@example.test`, name: tag, passwordHash: "!test", branchId: b.id }]).returning();
    actor = { id: u.id, email: u.email, name: u.name, branchId: a.id, permissions: ["*"], roles: [] };
    other = { id: v.id, email: v.email, name: v.name, branchId: b.id, permissions: ["*"], roles: [] };
    const [c] = await db.insert(customers).values({ branchId: a.id, code: tag, name: tag, type: "PERORANGAN" }).returning();
    customerId = c.id;
    // COA is seeded in this database by the repair test setup.
    expect((await db.select().from(accounts)).length).toBeGreaterThan(5);
  });

  it("harga paket preview sama dengan invoice dan pembayaran pending tersimpan atomik", async () => {
    const [p] = await db.insert(products).values({ code: tag, name: tag, salePrice: 500_000n, hppBasis: 100_000n, type: "PRODUK_OLAH", unit: "BOX", branchId: actor.branchId }).returning();
    const [pkg] = await db.insert(packages).values({ code: tag, name: tag, slug: tag, discountBps: 1000, branchId: actor.branchId }).returning();
    await db.insert(packageItems).values({ packageId: pkg.id, productId: p.id, quantity: 2, unitPrice: p.salePrice });
    const items = [{ kind: "PAKET" as const, entityId: pkg.id, description: tag, quantity: 1, unitPrice: 0n, discountBps: 0, isFree: false }];
    const quote = await previewOrderPricing({ items, shippingAmount: 25_000n }, actor);
    expect(quote.total).toBe("925000");
    orderId = await createOrder({ customerId, items: items.map((i) => ({ ...i, unitPrice: "0" })), shippingAmount: "25000", expectedTotal: quote.total, confirmImmediately: true }, actor);
    const [inv] = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
    invoiceId = inv.id;
    expect(inv.total).toBe(925_000n);
    const pending = await db.select().from(payments).where(eq(payments.orderId, orderId));
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("PENDING");
    expect((await db.select().from(productionBatches).where(eq(productionBatches.orderId, orderId)))).toHaveLength(1);
    await expect(createOrder({ customerId, items: items.map((i) => ({ ...i, unitPrice: "0" })), expectedTotal: "1" }, actor)).rejects.toThrow(/Harga berubah/);
  });

  it("dua konfirmasi bersamaan hanya mencatat satu penerimaan", async () => {
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    await Promise.all([confirmPayment({ paymentId: pay.id, status: "CONFIRMED" }, actor), confirmPayment({ paymentId: pay.id, status: "CONFIRMED" }, actor)]);
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(inv.totalPaid).toBe(925_000n);
    expect(ord.paidConfirmed).toBe(925_000n);
    expect(await db.select().from(journals).where(and(eq(journals.sourceModule, "payments"), eq(journals.sourceEntityId, pay.id)))).toHaveLength(1);
    await expect(confirmPayment({ paymentId: pay.id, status: "CONFIRMED" }, other)).rejects.toThrow(/cabang/);
  });

  it("nominal KPI tetap dalam rupiah penuh", async () => {
    const value = await FORMULAS.revenue({ start: "2026-01-01", end: "2027-12-31", branchId: actor.branchId!, scope: "COMPANY" });
    expect(value).toBe(925_000);
  });

  it("stok keluar berlebih rollback, penyesuaian nol diizinkan, pembacaan terpisah cabang", async () => {
    const id = await createInventoryItem({ name: tag, qty: 5, unitCost: 10_000n }, actor.branchId!, actor.id);
    await expect(adjustStock(id, "OUT", 6, tag, actor.id)).rejects.toThrow(/mencukupi/);
    expect((await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)))[0].qty).toBe(5);
    expect((await db.select().from(inventoryLots).where(eq(inventoryLots.itemId, id)))[0].qtyRemaining).toBe(5);
    expect((await listInventoryItems(other)).some((x) => x.id === id)).toBe(false);
    await adjustStock(id, "ADJUST", 0, tag, actor.id);
    expect((await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)))[0].qty).toBe(0);
  });

  it("QC gagal menahan batch; lolos QC memposting HPP", async () => {
    const stockId = await createInventoryItem({ name: tag + "prod", qty: 5, unitCost: 10_000n }, actor.branchId!, actor.id);
    const [batch] = await db.insert(productionBatches).values({ branchId: actor.branchId!, batchNumber: tag, itemName: tag, qtyPlanned: 2, inventoryItemId: stockId, stage: "QC", qcStatus: "FAIL" }).returning();
    await expect(advanceProdStage(batch.id, actor)).rejects.toThrow(/QC/);
    await db.update(productionBatches).set({ qcStatus: "PASS" }).where(eq(productionBatches.id, batch.id));
    await advanceProdStage(batch.id, actor);
    const [journal] = await db.select().from(journals).where(eq(journals.sourceEntityId, batch.id));
    expect(journal.debitTotal).toBe(20_000n);
    expect(journal.branchId).toBe(actor.branchId);
    await advanceProdStage(batch.id, actor);
    expect(await db.select().from(journals).where(eq(journals.sourceEntityId, batch.id))).toHaveLength(1);
  });

  it("payroll final tidak berubah dan finalisasi berulang tidak membuat jurnal ganda", async () => {
    const [emp] = await db.insert(employees).values({ branchId: actor.branchId!, employeeNumber: tag, name: tag, basicSalary: 1_000_000n }).returning();
    const [run] = await db.insert(payrollRuns).values({ branchId: actor.branchId!, period: "2026-11", totalNet: 1_000_000n }).returning();
    const [line] = await db.insert(payrollLines).values({ runId: run.id, employeeId: emp.id, employeeNumber: tag, employeeName: tag, basic: 1_000_000n, net: 1_000_000n }).returning();
    await Promise.all([finalizePayrollRun(run.id, actor), finalizePayrollRun(run.id, actor)]);
    await expect(updatePayrollLine(line.id, { allowance: 100n }, actor)).rejects.toThrow(/final/);
    const [journal] = await db.select().from(journals).where(eq(journals.sourceEntityId, run.id));
    expect(journal.branchId).toBe(actor.branchId);
    expect(await db.select().from(journals).where(eq(journals.sourceEntityId, run.id))).toHaveLength(1);
    expect((await db.select().from(payrollLines).where(eq(payrollLines.id, line.id)))[0].net).toBe(1_000_000n);
    // Missing required COA causes a complete rollback, not a finalized run without a journal.
    const [run2] = await db.insert(payrollRuns).values({ branchId: actor.branchId!, period: "2026-12", totalNet: 100n }).returning();
    await db.update(accounts).set({ isActive: false }).where(eq(accounts.code, "5-1210"));
    try { await expect(finalizePayrollRun(run2.id, actor)).rejects.toThrow(/nonaktif/); }
    finally { await db.update(accounts).set({ isActive: true }).where(eq(accounts.code, "5-1210")); }
    expect((await db.select().from(payrollRuns).where(eq(payrollRuns.id, run2.id)))[0].status).toBe("DRAFT");
    expect(await db.select().from(journals).where(eq(journals.sourceEntityId, run2.id))).toHaveLength(0);
  });

  it("pesanan batal tidak dapat ditandai terkirim", async () => {
    const [ord] = await db.insert(orders).values({ branchId: actor.branchId!, customerId, orderNumber: tag + "cancel", status: "CANCELLED" }).returning();
    const [task] = await db.insert(deliveryTasks).values({ branchId: actor.branchId!, orderId: ord.id, destination: tag, status: "IN_TRANSIT" }).returning();
    await expect(setDeliveryStatus(task.id, "ARRIVED", actor)).rejects.toThrow(/dibatalkan/);
    expect((await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, task.id)))[0].status).toBe("IN_TRANSIT");
  });

  it("tanda baca broadcast terpisah per pengguna dan tidak bocor ke cabang lain", async () => {
    const [note] = await db.insert(notifications).values({ title: tag, branchId: actor.branchId, userId: null }).returning();
    expect((await listInbox(other)).some((n) => n.id === note.id)).toBe(false);
    await markRead(note.id, actor);
    expect((await listInbox(actor)).find((n) => n.id === note.id)?.isRead).toBe(true);
    const [note2] = await db.insert(notifications).values({ title: tag, branchId: null, userId: null }).returning();
    await markRead(note2.id, actor);
    expect((await listInbox(other)).find((n) => n.id === note2.id)?.isRead).toBe(false);
  });

  it("idempotency gagal dapat dicoba ulang dan sukses diputar ulang", async () => {
    const key = { key: tag, scope: "repair" };
    await expect(withIdempotency(key, async () => { throw new Error("transient"); })).rejects.toThrow("transient");
    const value = await withIdempotency(key, async () => ({ ok: true }));
    expect(value.replay).toBe(false);
    expect((await withIdempotency(key, async () => { throw new Error("must not run"); })).replay).toBe(true);
  });

  it("webhook bertanda tangan diproses sekali dan bisa dicoba ulang setelah pembayaran tersedia", async () => {
    const previous = process.env.BSI_WEBHOOK_SECRET;
    process.env.BSI_WEBHOOK_SECRET = "local-repair-webhook-test";
    try {
      const reference = tag + "-va";
      const payload = { amount: "1000", reference, status: "PAID" as const, transactionId: tag + "-webhook", paidAt: new Date().toISOString() };
      const body = JSON.stringify(payload);
      const signature = hmacSha256(process.env.BSI_WEBHOOK_SECRET, body);
      expect((await handleBsiVaCallback(payload, signature, body)).reason).toBe("PAYMENT_NOT_FOUND");
      const [ord] = await db.insert(orders).values({ branchId: actor.branchId!, customerId, orderNumber: tag + "-va", total: 1000n, balance: 1000n }).returning();
      const [pay] = await db.insert(payments).values({ branchId: actor.branchId!, orderId: ord.id, customerId, paymentNumber: tag + "-va", method: "VA", providerRef: reference, amount: 1000n }).returning();
      expect((await handleBsiVaCallback(payload, signature, body)).ok).toBe(true);
      expect((await handleBsiVaCallback(payload, signature, body)).ok).toBe(true);
      expect((await db.select().from(orders).where(eq(orders.id, ord.id)))[0].paidConfirmed).toBe(1000n);
      expect(await db.select().from(journals).where(eq(journals.sourceEntityId, pay.id))).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.BSI_WEBHOOK_SECRET; else process.env.BSI_WEBHOOK_SECRET = previous;
    }
  });

  afterAll(async () => {
    // Fixtures remain in the disposable database for browser inspection; never touch a real DB.
    await connection.end();
  });
});
