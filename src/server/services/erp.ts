import "server-only";
import { branchWhere, assertResourceAccess } from "@/lib/server/resource-access";
import { assertBranchAccess } from "@/lib/branch-access";
import { InvalidOperationError, NotFoundError, ValidationError } from "@/lib/errors";
import { validateStockMove, requirePassingQc, payrollNet, validateDeliveryTransition } from "@/server/operational-policy";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, inventoryLots, inventoryMoves } from "@/db/schema/erp-extensions";
import { planFifoConsumption } from "@/server/inventory-fifo";
import { postJournal, COA } from "@/server/services/journal";
import { insertAudit, type Tx } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export async function listInventoryItems(actor: AuthUser, includeInactive = false) {
  const conds = [branchWhere(actor, inventoryItems.branchId), includeInactive ? undefined : eq(inventoryItems.isActive, true)];
  const rows =
    conds.length === 0
      ? await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name))
      : await db.select().from(inventoryItems).where(and(...conds)).orderBy(asc(inventoryItems.name));

  const values = await db
    .select({
      itemId: inventoryLots.itemId,
      value: sql<string>`coalesce(sum(${inventoryLots.qtyRemaining} * ${inventoryLots.unitCost}), 0)::bigint`,
    })
    .from(inventoryLots)
    .groupBy(inventoryLots.itemId);
  const valueByItem = new Map(values.map((v) => [v.itemId, BigInt(v.value)]));
  return rows.map((row) => ({ ...row, stockValue: valueByItem.get(row.id) ?? 0n }));
}

interface StockMoveContext {
  reason: string;
  refModule?: string;
  refId?: string;
  userId?: string | null;
}

/** Stok masuk: buat lot baru + kartu stok IN (dengan harga satuan). */
async function receiveStock(
  tx: Tx,
  opts: StockMoveContext & { itemId: string; qty: number; unitCost: bigint; direction?: "IN" | "ADJUST" }
): Promise<bigint> {
  if (opts.qty <= 0) return 0n;
  const totalCost = opts.unitCost * BigInt(opts.qty);
  await tx.insert(inventoryLots).values({
    itemId: opts.itemId,
    refModule: opts.refModule ?? null,
    refId: opts.refId ?? null,
    qtyIn: opts.qty,
    qtyRemaining: opts.qty,
    unitCost: opts.unitCost,
    createdBy: opts.userId ?? null,
  });
  await tx.insert(inventoryMoves).values({
    itemId: opts.itemId,
    direction: opts.direction ?? "IN",
    qty: opts.qty,
    reason: opts.reason,
    refModule: opts.refModule ?? null,
    refId: opts.refId ?? null,
    unitCost: opts.unitCost,
    totalCost,
    createdBy: opts.userId ?? null,
  });
  return totalCost;
}

/** Stok keluar: konsumsi lot tertua (FIFO) + kartu stok OUT dengan total HPP. */
async function consumeStockFifo(
  tx: Tx,
  opts: StockMoveContext & { itemId: string; qty: number; direction?: "OUT" | "ADJUST"; moveQty?: number }
): Promise<{ totalCost: bigint; shortage: number }> {
  if (opts.qty <= 0) return { totalCost: 0n, shortage: 0 };
  const lots = await tx
    .select()
    .from(inventoryLots)
    .where(eq(inventoryLots.itemId, opts.itemId))
    .orderBy(asc(inventoryLots.receivedAt), asc(inventoryLots.id))
    .for("update");
  const plan = planFifoConsumption(
    lots.map((l) => ({ id: l.id, qtyRemaining: l.qtyRemaining, unitCost: l.unitCost, receivedAt: l.receivedAt })),
    opts.qty
  );
  if (plan.shortage > 0) throw new InvalidOperationError(`Stok lot tidak mencukupi (kurang ${plan.shortage}).`);
  for (const alloc of plan.allocations) {
    await tx
      .update(inventoryLots)
      .set({ qtyRemaining: sql`${inventoryLots.qtyRemaining} - ${alloc.qty}` })
      .where(eq(inventoryLots.id, alloc.lotId));
  }
  await tx.insert(inventoryMoves).values({
    itemId: opts.itemId,
    direction: opts.direction ?? "OUT",
    qty: opts.moveQty ?? opts.qty,
    reason: opts.reason,
    refModule: opts.refModule ?? null,
    refId: opts.refId ?? null,
    unitCost: plan.totalCost / BigInt(opts.qty),
    totalCost: plan.totalCost,
    createdBy: opts.userId ?? null,
  });
  return { totalCost: plan.totalCost, shortage: plan.shortage };
}

export async function createInventoryItem(
  input: { name: string; category?: string; unit?: string; qty?: number; minQty?: number; location?: string; notes?: string; unitCost?: bigint },
  branchId: string,
  userId: string
): Promise<string> {
  validateStockMove("ADJUST", input.qty ?? 0, input.unitCost ?? 0n);
  if (!input.name.trim() || !Number.isSafeInteger(input.minQty ?? 0) || (input.minQty ?? 0) < 0) throw new ValidationError("Data item tidak valid.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(inventoryItems)
      .values({
        branchId,
        name: input.name,
        category: input.category ?? "BAHAN",
        unit: input.unit ?? "buah",
        qty: input.qty ?? 0,
        minQty: input.minQty ?? 0,
        location: input.location ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      })
      .returning({ id: inventoryItems.id });
    const qty = input.qty ?? 0;
    if (qty > 0) {
      await receiveStock(tx, {
        itemId: row.id,
        qty,
        unitCost: input.unitCost ?? 0n,
        reason: "Stok awal",
        refModule: "OPENING",
        userId,
      });
    }
    return row.id;
  });
}

export async function updateInventoryItem(
  id: string,
  input: Partial<{ name: string; category: string; unit: string; minQty: number; location: string; notes: string; isActive: boolean }>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "category", "unit", "minQty", "location", "notes", "isActive"] as const) {
    if (input[k] !== undefined && k in input) patch[k] = input[k];
  }
  if (Object.keys(patch).length > 0) await db.update(inventoryItems).set(patch).where(eq(inventoryItems.id, id));
}

/** Sesuaikan stok: IN (masuk + lot baru), OUT (FIFO), ADJUST (set nilai absolut). */
export async function adjustStock(
  itemId: string,
  direction: "IN" | "OUT" | "ADJUST",
  qty: number,
  reason: string,
  userId: string,
  unitCost: bigint = 0n
): Promise<void> {
  validateStockMove(direction, qty, unitCost);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1).for("update");
    if (!row) throw new Error("Item tidak ditemukan.");
    const ctx = { itemId, reason, refModule: "MANUAL", userId };

    if (direction === "IN") {
      await receiveStock(tx, { ...ctx, qty, unitCost });
      await tx.update(inventoryItems).set({ qty: row.qty + qty }).where(eq(inventoryItems.id, itemId));
      return;
    }

    if (direction === "OUT") {
      if (qty > row.qty) throw new InvalidOperationError("Stok tidak mencukupi.");
      await consumeStockFifo(tx, { ...ctx, qty });
      await tx.update(inventoryItems).set({ qty: row.qty - qty }).where(eq(inventoryItems.id, itemId));
      return;
    }

    const target = Math.max(0, qty);
    const delta = target - row.qty;
    if (delta > 0) {
      await receiveStock(tx, { ...ctx, qty: delta, unitCost, direction: "ADJUST" });
    } else if (delta < 0) {
      await consumeStockFifo(tx, { ...ctx, qty: -delta, direction: "ADJUST", moveQty: target });
    } else {
      await tx.insert(inventoryMoves).values({ itemId, direction: "ADJUST", qty: target, reason, refModule: "MANUAL", createdBy: userId });
    }
    await tx.update(inventoryItems).set({ qty: target }).where(eq(inventoryItems.id, itemId));
  });
}

export async function listInventoryMoves(itemId: string, limit = 20) {
  return db
    .select()
    .from(inventoryMoves)
    .where(eq(inventoryMoves.itemId, itemId))
    .orderBy(desc(inventoryMoves.createdAt))
    .limit(limit);
}

export async function deleteInventoryItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(inventoryItems).where(inArray(inventoryItems.id, ids));
}

/* ── Jurnal otomatis (payroll & kasbon) ──────────────────────────── */
async function journalForPayroll(tx: Tx, run: typeof payrollRuns.$inferSelect, actor: AuthUser): Promise<void> {
  if (run.totalNet <= 0n) throw new InvalidOperationError("Total payroll harus lebih dari nol.");
  await postJournal({ exec: tx, branchId: run.branchId, type: "PAYROLL", journalDate: new Date(),
    description: `Payroll ${run.period}`, sourceModule: "payroll", sourceEntityType: "payroll_run", sourceEntityId: run.id,
    lines: [
      { accountCode: COA.EXPENSE_PAYROLL, debit: run.totalNet, credit: 0n },
      { accountCode: COA.BANK, debit: 0n, credit: run.totalNet },
    ], actor });
}

async function journalForKasbon(tx: Tx, kb: typeof kasbons.$inferSelect, actor: AuthUser): Promise<void> {
  await postJournal({ exec: tx, branchId: kb.branchId, type: "EXPENSE", journalDate: new Date(),
    description: `Kasbon dibayar: ${kb.employeeName}`, sourceModule: "kasbon", sourceEntityType: "kasbon", sourceEntityId: kb.id,
    lines: [
      { accountCode: COA.EMPLOYEE_RECEIVABLE, debit: kb.amount, credit: 0n },
      { accountCode: COA.BANK, debit: 0n, credit: kb.amount },
    ], actor });
}

/* ── Payroll ───────────────────────────────────────────────────────── */

import { payrollLines, payrollRuns, kasbons } from "@/db/schema/erp-extensions";
import { productionBatches, deliveryTasks, kitchenTasks } from "@/db/schema/erp-extensions";
import { packageItems } from "@/db/schema/products";
import { products } from "@/db/schema/products";
import { customers } from "@/db/schema/crm";
import { orders, orderItems } from "@/db/schema/sales";
import { employees } from "@/db/schema/performance";

export async function listPayrollRuns(actor: AuthUser) {
  return db.select().from(payrollRuns).where(branchWhere(actor, payrollRuns.branchId)).orderBy(desc(payrollRuns.period)).limit(60);
}

export async function createPayrollRun(period: string, branchId: string, userId: string): Promise<string> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ValidationError("Periode payroll tidak valid.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`payroll:${branchId}:${period}`}, 0))`);
  const existing = await tx
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.branchId, branchId), eq(payrollRuns.period, period)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const emps = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.branchId, branchId), sql`${employees.deletedAt} is null`, eq(employees.status, "AKTIF")))
    .orderBy(asc(employees.employeeNumber));

  const [run] = await tx
    .insert(payrollRuns)
    .values({ branchId, period, createdBy: userId })
    .returning({ id: payrollRuns.id });

  let total = 0n;
  for (const e of emps) {
    const basic = e.basicSalary ?? 0n;
    total += basic;
    await tx.insert(payrollLines).values({
      runId: run.id,
      employeeId: e.id,
      employeeNumber: e.employeeNumber,
      employeeName: e.name,
      basic,
      net: basic,
    });
  }
  await tx.update(payrollRuns).set({ totalNet: total }).where(eq(payrollRuns.id, run.id));
  return run.id;
  });
}

export async function listPayrollLines(runId: string, actor: AuthUser) {
  await assertResourceAccess("payroll", runId, actor);
  return db.select().from(payrollLines).where(eq(payrollLines.runId, runId)).orderBy(asc(payrollLines.employeeNumber));
}

export async function updatePayrollLine(id: string, input: Partial<{ allowance: bigint; deduction: bigint; note: string }>, actor: AuthUser): Promise<void> {
  await db.transaction(async (tx) => {
    let [line] = await tx.select().from(payrollLines).where(eq(payrollLines.id, id)).limit(1);
    if (!line) throw new NotFoundError("Baris tidak ditemukan.");
    const [run] = await tx.select().from(payrollRuns).where(eq(payrollRuns.id, line.runId)).for("update");
    if (!run) throw new NotFoundError();
    assertBranchAccess(actor, run.branchId);
    [line] = await tx.select().from(payrollLines).where(eq(payrollLines.id, id)).limit(1);
    const allowance = input.allowance ?? line.allowance;
    const deduction = input.deduction ?? line.deduction;
    const net = payrollNet(run.status, line.basic, allowance, deduction);
    await tx.update(payrollLines).set({ allowance, deduction, net, note: input.note ?? line.note }).where(eq(payrollLines.id, id));
    const [{ total }] = await tx.select({ total: sql<string>`coalesce(sum(${payrollLines.net}), 0)` }).from(payrollLines).where(eq(payrollLines.runId, run.id));
    await tx.update(payrollRuns).set({ totalNet: BigInt(total) }).where(eq(payrollRuns.id, run.id));
    await insertAudit(tx, { actor, action: "UPDATE", module: "payroll", entityType: "payroll_line", entityId: id,
      after: { allowance: allowance.toString(), deduction: deduction.toString(), net: net.toString() } });
  });
}

export async function finalizePayrollRun(id: string, actor: AuthUser): Promise<void> {
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(payrollRuns).where(eq(payrollRuns.id, id)).for("update");
    if (!run) throw new NotFoundError("Payroll tidak ditemukan.");
    assertBranchAccess(actor, run.branchId);
    if (run.status === "FINAL") return;
    await journalForPayroll(tx, run, actor);
    await tx.update(payrollRuns).set({ status: "FINAL", finalizedAt: new Date(), finalizedBy: actor.id }).where(eq(payrollRuns.id, id));
    await insertAudit(tx, { actor, action: "APPROVE", module: "payroll", entityType: "payroll_run", entityId: id });
  });
}

/* ── Kasbon ───────────────────────────────────────────────────────── */

export async function listKasbons(actor: AuthUser, status?: string) {
  const condition = status && ["PENGAJUAN", "DISETUJUI", "DIBAYAR", "DIBATALKAN"].includes(status) ? eq(kasbons.status, status as "PENGAJUAN") : undefined;
  return db.select().from(kasbons).where(and(branchWhere(actor, kasbons.branchId), condition)).orderBy(desc(kasbons.createdAt)).limit(120);
}

export async function createKasbon(
  input: { employeeId: string; amount: bigint; reason?: string },
  branchId: string,
  userId: string
): Promise<string> {
  const [e] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  if (!e || e.branchId !== branchId) throw new NotFoundError("Karyawan tidak ditemukan pada cabang ini.");
  if (input.amount <= 0n) throw new ValidationError("Nominal harus lebih dari nol.");
  const [row] = await db
    .insert(kasbons)
    .values({
      branchId,
      employeeId: e.id,
      employeeName: e.name,
      employeeNumber: e.employeeNumber,
      amount: input.amount,
      reason: input.reason ?? null,
      createdBy: userId,
    })
    .returning({ id: kasbons.id });
  return row.id;
}

export async function changeKasbonStatus(id: string, status: "DISETUJUI" | "DIBAYAR" | "DIBATALKAN" | "PENGAJUAN", actor: AuthUser): Promise<void> {
  await db.transaction(async (tx) => {
    const [kb] = await tx.select().from(kasbons).where(eq(kasbons.id, id)).for("update");
    if (!kb) throw new NotFoundError();
    assertBranchAccess(actor, kb.branchId);
    if (kb.status === status) return;
    const transitions: Record<string, string[]> = { PENGAJUAN: ["DISETUJUI", "DIBATALKAN"], DISETUJUI: ["DIBAYAR", "DIBATALKAN"], DIBAYAR: [], DIBATALKAN: [] };
    if (!transitions[kb.status]?.includes(status)) throw new InvalidOperationError("Transisi kasbon tidak diizinkan.");
    if (status === "DIBAYAR") await journalForKasbon(tx, kb, actor);
    await tx.update(kasbons).set({ status, approvedAt: status === "DISETUJUI" ? new Date() : kb.approvedAt,
      paidAt: status === "DIBAYAR" ? new Date() : kb.paidAt }).where(eq(kasbons.id, id));
    await insertAudit(tx, { actor, action: "TRANSITION", module: "kasbon", entityType: "kasbon", entityId: id, before: { status: kb.status }, after: { status } });
  });
}

/* ── ZISWAF ───────────────────────────────────────────────────────── */

import { ziswafEntries } from "@/db/schema/erp-extensions";

export async function listZiswaf(actor: AuthUser, limit = 120) {
  return db.select().from(ziswafEntries).where(branchWhere(actor, ziswafEntries.branchId)).orderBy(desc(ziswafEntries.eventDate)).limit(limit);
}

export async function createZiswaf(
  input: { kind: "ZAKAT" | "INFAK" | "SEDEKAH" | "WAKAF"; direction: "IN" | "OUT"; amount: bigint; party: string; eventDate?: Date; note?: string },
  branchId: string,
  userId: string
): Promise<string> {
  const [row] = await db
    .insert(ziswafEntries)
    .values({
      branchId,
      kind: input.kind,
      direction: input.direction,
      amount: input.amount,
      party: input.party,
      eventDate: input.eventDate ?? new Date(),
      note: input.note ?? null,
      createdBy: userId,
    })
    .returning({ id: ziswafEntries.id });
  await insertAudit(db, {
    actor: { id: userId, email: "", name: "", branchId, roles: [], permissions: ["ziswaf"] },
    action: "CREATE",
    module: "ziswaf",
    entityType: "ziswaf_entry",
    entityId: row.id,
    after: { kind: input.kind, direction: input.direction, amount: input.amount.toString(), party: input.party },
  });
  return row.id;
}



/** Edit entri ZISWAF. */
export async function updateZiswafEntry(
  id: string,
  input: { amount?: bigint; party?: string; eventDate?: Date; note?: string },
  userId: string,
  branchId: string | null
): Promise<void> {
  const [row] = await db.select().from(ziswafEntries).where(eq(ziswafEntries.id, id)).limit(1);
  if (!row) return;
  const before = { ...row, amount: row.amount.toString() };
  const patch: Record<string, unknown> = {};
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.party !== undefined) patch.party = input.party;
  if (input.eventDate !== undefined) patch.eventDate = input.eventDate;
  if (input.note !== undefined) patch.note = input.note;
  await db.update(ziswafEntries).set(patch).where(eq(ziswafEntries.id, id));
  await insertAudit(db, {
    actor: { id: userId, email: "", name: "", branchId, roles: [], permissions: ["ziswaf"] },
    action: "UPDATE",
    module: "ziswaf",
    entityType: "ziswaf_entry",
    entityId: id,
    before,
    after: { ...patch, amount: input.amount !== undefined ? input.amount.toString() : undefined },
  });
}

/** Hapus entri ZISWAF (bulk). */
export async function deleteZiswafEntries(ids: string[], userId: string, branchId: string | null): Promise<{ error?: string }> {
  const rows = await db.select().from(ziswafEntries).where(inArray(ziswafEntries.id, ids));
  await db.delete(ziswafEntries).where(inArray(ziswafEntries.id, ids));
  for (const r of rows) {
    await insertAudit(db, {
      actor: { id: userId, email: "", name: "", branchId, roles: [], permissions: ["ziswaf"] },
      action: "DELETE",
      module: "ziswaf",
      entityType: "ziswaf_entry",
      entityId: r.id,
      before: { ...r, amount: r.amount.toString() },
    });
  }
  return {};
}

/** Hapus tugas dapur (bulk). */
export async function deleteKitchenTasks(ids: string[], userId: string, branchId: string | null): Promise<{ error?: string }> {
  const rows = await db.select().from(kitchenTasks).where(inArray(kitchenTasks.id, ids));
  await db.delete(kitchenTasks).where(inArray(kitchenTasks.id, ids));
  for (const r of rows) {
    await insertAudit(db, {
      actor: { id: userId, email: "", name: "", branchId, roles: [], permissions: ["production"] },
      action: "DELETE",
      module: "production",
      entityType: "kitchen_task",
      entityId: r.id,
      before: r,
    });
  }
  return {};
}

export async function ziswafSummary(actor: AuthUser) {
  const rows = await db
    .select({
      kind: ziswafEntries.kind,
      masuk: sql<string>`coalesce(sum(case when ${ziswafEntries.direction} = 'IN' then ${ziswafEntries.amount} else 0 end), 0)`,
      keluar: sql<string>`coalesce(sum(case when ${ziswafEntries.direction} = 'OUT' then ${ziswafEntries.amount} else 0 end), 0)`,
    })
    .from(ziswafEntries)
    .where(branchWhere(actor, ziswafEntries.branchId))
    .groupBy(ziswafEntries.kind);
  return rows.map((r) => ({
    kind: r.kind,
    masuk: BigInt(String(r.masuk ?? 0)),
    keluar: BigInt(String(r.keluar ?? 0)),
    saldo: BigInt(String(r.masuk ?? 0)) - BigInt(String(r.keluar ?? 0)),
  }));
}

export async function inventoryCount(): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryItems);
  return Number(count);
}

/* ── Produksi ─────────────────────────────────────────────────────── */


/** Wire Pipeline: Order dikonfirmasi → batch produksi + tugas pengiriman otomatis. */
export async function createOpsFlowFromOrder(
  order: {
    id: string;
    branchId: string;
    orderNumber: string;
    shohibulName: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    deliveryAddress: string | null;
    deliveryCity: string | null;
    deliveryDate: Date | null;
    deliveryTimeSlot: string | null;
  },
  userId: string,
  txLike: {
    insert: typeof db.insert;
    update: typeof db.update;
    select: typeof db.select;
  } = db
): Promise<void> {
  // Nama produk pengganti bila ada (ambil item pertama)
  const [firstItem] = await txLike
    .select({ description: orderItems.description })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .limit(1);
  const itemName = firstItem?.description ?? order.orderNumber;

  const [{ c }] = await txLike.select({ c: sql<number>`count(*)::int` }).from(productionBatches);
  const batchNumber = `BATCH-${order.orderNumber}-${String(Number(c) + 1).padStart(3, "0")}`;

  await txLike.insert(productionBatches).values({
    branchId: order.branchId,
    orderId: order.id,
    batchNumber,
    itemName,
    qtyPlanned: 1,
    notes: `Order ${order.orderNumber}`,
    createdBy: userId,
  });

  await txLike.insert(deliveryTasks).values({
    branchId: order.branchId,
    orderId: order.id,
    destination: order.deliveryAddress ?? order.deliveryCity ?? "-",
    contactName: order.recipientName ?? order.shohibulName ?? null,
    contactPhone: order.recipientPhone ?? null,
    scheduledAt: order.deliveryDate,
    status: "WAITING",
    trackingToken: newTrackingToken(),
    notes: `Order ${order.orderNumber} · slot ${order.deliveryTimeSlot ?? "-"}`,
    createdBy: userId,
  });

  // Tugas dapur otomatis (BOM): komponen paket + produk dari item order
  const kitchen = new Map<string, number>();
  const orderLines = await txLike
    .select({ kind: orderItems.kind, entityId: orderItems.entityId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  for (const line of orderLines) {
    if (line.kind === "PRODUK" && line.entityId) {
      const [prod] = await txLike
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, line.entityId))
        .limit(1);
      if (prod) {
        const key = `Siapkan ${prod.name}`;
        kitchen.set(key, (kitchen.get(key) ?? 0) + line.quantity);
      }
    }
    if (line.kind === "PAKET" && line.entityId) {
      const pkgLines = await txLike
        .select({ name: products.name, qty: packageItems.quantity })
        .from(packageItems)
        .leftJoin(products, eq(packageItems.productId, products.id))
        .where(eq(packageItems.packageId, line.entityId));
      for (const pkg of pkgLines) {
        if (!pkg.name) continue;
        const key = `${pkg.name} (komponen paket)`;
        kitchen.set(key, (kitchen.get(key) ?? 0) + pkg.qty * line.quantity);
      }
    }
  }
  if (kitchen.size > 0) {
    await txLike.insert(kitchenTasks).values(
      [...kitchen.entries()].map(([description, quantity]) => ({
        branchId: order.branchId,
        orderId: order.id,
        description,
        quantity,
      }))
    );
  }
}


const STAGES = ["RPH", "POTONG", "MASAK", "PACKING", "QC", "SIAP"] as const;
type Stage = (typeof STAGES)[number];

export async function listProductionBatches(actor: AuthUser, stage?: string) {
  const rows = await db.select().from(productionBatches).where(and(branchWhere(actor, productionBatches.branchId),
    stage && STAGES.includes(stage as Stage) ? eq(productionBatches.stage, stage as Stage) : undefined))
    .orderBy(desc(productionBatches.createdAt)).limit(100);
  if (rows.length === 0) return rows.map((r) => ({ ...r, hppCost: 0n }));

  const costs = await db
    .select({
      refId: inventoryMoves.refId,
      total: sql<string>`coalesce(sum(${inventoryMoves.totalCost}), 0)::bigint`,
    })
    .from(inventoryMoves)
    .where(and(eq(inventoryMoves.refModule, "PRODUCTION"), inArray(inventoryMoves.refId, rows.map((r) => r.id))))
    .groupBy(inventoryMoves.refId);
  const costByBatch = new Map(costs.map((c) => [c.refId ?? "", BigInt(c.total)]));
  return rows.map((r) => ({ ...r, hppCost: costByBatch.get(r.id) ?? 0n }));
}

export async function createProductionBatch(
  input: { itemName: string; qtyPlanned: number; notes?: string; inventoryItemId?: string },
  branchId: string,
  userId: string
): Promise<string> {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(productionBatches);
  const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Number(c) + 1).padStart(4, "0")}`;
  const [row] = await db
    .insert(productionBatches)
    .values({
      branchId,
      batchNumber,
      itemName: input.itemName,
      qtyPlanned: input.qtyPlanned,
      inventoryItemId: input.inventoryItemId ?? null,
      notes: input.notes ?? null,
      createdBy: userId,
    })
    .returning({ id: productionBatches.id });
  return row.id;
}

export async function advanceProdStage(id: string, actor: AuthUser): Promise<Stage> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(productionBatches).where(eq(productionBatches.id, id)).limit(1).for("update");
    if (!row) throw new Error("Batch tidak ditemukan.");
    assertBranchAccess(actor, row.branchId);
    requirePassingQc(row.stage, row.qcStatus);
    const i = STAGES.indexOf(row.stage as Stage);
    const next = i < 0 || i >= STAGES.length - 1 ? row.stage : STAGES[i + 1];
    await tx.update(productionBatches).set({ stage: next }).where(eq(productionBatches.id, id));

    // Wire: transisi pertama ke SIAP → order READY_DISPATCH + konsumsi stok FIFO + jurnal HPP.
    if (row.stage !== "SIAP" && next === "SIAP") {
      if (row.orderId) {
        const [ord] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, row.orderId)).limit(1);
        if (ord && !["DELIVERED", "COMPLETED", "CANCELLED"].includes(ord.status)) {
          await tx.update(orders).set({ status: "READY_DISPATCH" }).where(eq(orders.id, row.orderId));
        }
      }
      if (row.inventoryItemId && row.qtyPlanned > 0) {
        const [lockedItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, row.inventoryItemId)).for("update");
        if (!lockedItem || lockedItem.branchId !== row.branchId || lockedItem.qty < row.qtyPlanned) throw new InvalidOperationError("Stok produksi tidak mencukupi atau berbeda cabang.");
        const consumed = await consumeStockFifo(tx, {
          itemId: row.inventoryItemId,
          qty: row.qtyPlanned,
          reason: `Produksi ${row.batchNumber}`,
          refModule: "PRODUCTION",
          refId: row.id,
        });
        const [inv] = await tx
          .select({ qty: inventoryItems.qty })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, row.inventoryItemId))
          .limit(1);
        if (inv) {
          await tx
            .update(inventoryItems)
            .set({ qty: inv.qty - row.qtyPlanned })
            .where(eq(inventoryItems.id, row.inventoryItemId));
        }
        if (consumed.totalCost > 0n) {
          await postJournal({
            exec: tx,
            branchId: row.branchId,
            type: "PRODUCTION",
            journalDate: new Date(),
            description: `HPP produksi ${row.batchNumber}`,
            sourceModule: "production",
            sourceEntityType: "production_batch",
            sourceEntityId: row.id,
            lines: [
              { accountCode: COA.HPP, debit: consumed.totalCost, credit: 0n, referenceType: "production_batch" },
              { accountCode: COA.INVENTORY, debit: 0n, credit: consumed.totalCost, referenceType: "production_batch" },
            ],
            actor,
          });
        }
      }
    }
    return next;
  });
}

export async function setProdQc(id: string, qc: "PASS" | "FAIL"): Promise<void> {
  if (!["PASS", "FAIL"].includes(qc)) throw new ValidationError("Status QC tidak valid.");
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(productionBatches).where(eq(productionBatches.id, id)).for("update");
    if (!row) throw new NotFoundError();
    if (row.stage !== "QC") throw new InvalidOperationError("QC hanya dapat diperbarui pada tahap QC.");
    await tx.update(productionBatches).set({ qcStatus: qc }).where(eq(productionBatches.id, id));
  });
}

/* ── Pengiriman ───────────────────────────────────────────────────── */

const DSTATUSES = ["WAITING", "IN_TRANSIT", "ARRIVED", "GAGAL"] as const;
type DStatus = (typeof DSTATUSES)[number];

export async function listDeliveryTasks(actor: AuthUser, status?: string) {
  return db.select().from(deliveryTasks).where(and(branchWhere(actor, deliveryTasks.branchId),
    status && DSTATUSES.includes(status as DStatus) ? eq(deliveryTasks.status, status as DStatus) : undefined))
    .orderBy(desc(deliveryTasks.createdAt)).limit(100);
}

export async function createDeliveryTask(
  input: { destination: string; contactName?: string; contactPhone?: string; driverName?: string; vehiclePlate?: string; scheduledAt?: Date; notes?: string },
  branchId: string,
  userId: string
): Promise<string> {
  const [row] = await db
    .insert(deliveryTasks)
    .values({
      branchId,
      destination: input.destination,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      driverName: input.driverName ?? null,
      vehiclePlate: input.vehiclePlate ?? null,
      scheduledAt: input.scheduledAt ?? null,
      notes: input.notes ?? null,
      trackingToken: newTrackingToken(),
      createdBy: userId,
    })
    .returning({ id: deliveryTasks.id });
  return row.id;
}

async function deliveryTransition(tx: Tx, id: string, status: DStatus, actor: AuthUser) {
  const [row] = await tx.select().from(deliveryTasks).where(eq(deliveryTasks.id, id)).for("update");
  if (!row) throw new NotFoundError("Pengiriman tidak ditemukan.");
  assertBranchAccess(actor, row.branchId);
  const [order] = row.orderId ? await tx.select().from(orders).where(eq(orders.id, row.orderId)).for("update") : [];
  validateDeliveryTransition(row.status, status, order?.status);
  if (order && status === "IN_TRANSIT" && !["READY_DISPATCH", "DELIVERED", "COMPLETED"].includes(order.status)) {
    throw new InvalidOperationError("Pesanan belum siap dikirim.");
  }
  if (order && status === "ARRIVED" && !["READY_DISPATCH", "DELIVERED", "COMPLETED"].includes(order.status)) {
    throw new InvalidOperationError("Pesanan belum siap dikirim.");
  }
  if (order && status === "ARRIVED" && !["COMPLETED", "DELIVERED"].includes(order.status)) {
    await tx.update(orders).set({ status: "DELIVERED" }).where(eq(orders.id, order.id));
  }
  return row;
}

export async function setDeliveryStatus(id: string, status: DStatus, actor: AuthUser): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await deliveryTransition(tx, id, status, actor);
    await tx.update(deliveryTasks).set({ status, deliveredAt: status === "ARRIVED" ? row.deliveredAt ?? new Date() : null }).where(eq(deliveryTasks.id, id));
    await insertAudit(tx, { actor, action: "TRANSITION", module: "delivery", entityType: "delivery_task", entityId: id,
      before: { status: row.status }, after: { status } });
  });
}

/** Simpan POD (foto, tanda tangan, suhu, GPS, checklist syariah) + tandai tugas ARRIVED. */
export async function recordDeliveryPod(
  id: string,
  input: {
    recipientName?: string;
    photoUrl?: string;
    signatureUrl?: string;
    tempC?: number;
    geo?: string;
    checklist?: string[];
    notes?: string;
  },
  actor: AuthUser
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "ARRIVED",
    deliveredAt: new Date(),
    podAt: new Date(),
  };
  if (input.recipientName) patch.podRecipientName = input.recipientName.slice(0, 160);
  if (input.photoUrl) patch.podPhotoUrl = input.photoUrl;
  if (input.signatureUrl) patch.podSignatureUrl = input.signatureUrl;
  if (typeof input.tempC === "number" && Number.isFinite(input.tempC)) patch.podTempC = Math.round(input.tempC);
  if (input.geo) patch.podGeo = input.geo.slice(0, 80);
  if (input.checklist && input.checklist.length > 0) patch.podChecklist = input.checklist.join(", ").slice(0, 500);
  if (input.notes) patch.podNotes = input.notes.slice(0, 240);
  if (!input.geo || !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(input.geo)) throw new ValidationError("Lokasi GPS tidak valid.");
  const [lat, lng] = input.geo.split(",").map(Number);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ValidationError("Lokasi GPS tidak valid.");
  if (!input.photoUrl && !input.signatureUrl) throw new ValidationError("Bukti penerimaan wajib diisi.");
  await db.transaction(async (tx) => {
    const row = await deliveryTransition(tx, id, "ARRIVED", actor);
    if (row.podAt) throw new InvalidOperationError("Bukti penerimaan sudah tersimpan.");
    await tx.update(deliveryTasks).set(patch).where(eq(deliveryTasks.id, id));
    await insertAudit(tx, { actor, action: "UPDATE", module: "delivery", entityType: "delivery_task", entityId: id, after: { status: "ARRIVED", pod: true } });
  });
}

/** Konteks WA untuk tombol kirim WhatsApp dari batch produksi. */
export async function getBatchWaContext(id: string) {
  const [row] = await db
    .select({
      batchNumber: productionBatches.batchNumber,
      itemName: productionBatches.itemName,
      stage: productionBatches.stage,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      childName: orders.childName,
      aqiqahType: orders.aqiqahType,
      recipientPhone: orders.recipientPhone,
      customerPhone: customers.phone,
      customerName: customers.name,
    })
    .from(productionBatches)
    .leftJoin(orders, eq(productionBatches.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(productionBatches.id, id))
    .limit(1);
  return row ?? null;
}

/** Konteks WA untuk tugas pengiriman (dipakai saat POD tersimpan). */
export async function getTaskWaContext(id: string) {
  const [row] = await db
    .select({
      destination: deliveryTasks.destination,
      contactName: deliveryTasks.contactName,
      contactPhone: deliveryTasks.contactPhone,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      childName: orders.childName,
      recipientPhone: orders.recipientPhone,
      customerPhone: customers.phone,
    })
    .from(deliveryTasks)
    .leftJoin(orders, eq(deliveryTasks.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(deliveryTasks.id, id))
    .limit(1);
  return row ?? null;
}

/* ── Lacak pesanan (tautan publik) ────────────────────────────────── */

function newTrackingToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Ambil/buat token lacak untuk satu tugas pengiriman. */
export async function ensureDeliveryTrackingToken(id: string): Promise<string | null> {
  const [row] = await db
    .select({ token: deliveryTasks.trackingToken })
    .from(deliveryTasks)
    .where(eq(deliveryTasks.id, id))
    .limit(1);
  if (!row) return null;
  if (row.token) return row.token;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = newTrackingToken();
    const [updated] = await db
      .update(deliveryTasks)
      .set({ trackingToken: token })
      .where(and(eq(deliveryTasks.id, id), isNull(deliveryTasks.trackingToken)))
      .returning({ token: deliveryTasks.trackingToken });
    if (updated?.token) return updated.token;

    const [again] = await db
      .select({ token: deliveryTasks.trackingToken })
      .from(deliveryTasks)
      .where(eq(deliveryTasks.id, id))
      .limit(1);
    if (again?.token) return again.token;
    if (!again) return null;
  }
  return null;
}

export type DeliveryTracking = {
  status: "WAITING" | "IN_TRANSIT" | "ARRIVED" | "GAGAL";
  destination: string;
  contactName: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  scheduledAt: Date | null;
  deliveredAt: Date | null;
  orderNumber: string | null;
  childName: string | null;
  shohibulName: string | null;
  deliveryTimeSlot: string | null;
  podRecipientName: string | null;
  podAt: Date | null;
  podTempC: number | null;
  podChecklist: string | null;
};

const TRACKING_TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

/** Data aman untuk halaman lacak publik (tanpa telepon/alamat lengkap). */
export async function getDeliveryTracking(token: string): Promise<DeliveryTracking | null> {
  if (!TRACKING_TOKEN_RE.test(token)) return null;
  const [row] = await db
    .select({
      status: deliveryTasks.status,
      destination: deliveryTasks.destination,
      contactName: deliveryTasks.contactName,
      driverName: deliveryTasks.driverName,
      vehiclePlate: deliveryTasks.vehiclePlate,
      scheduledAt: deliveryTasks.scheduledAt,
      deliveredAt: deliveryTasks.deliveredAt,
      orderNumber: orders.orderNumber,
      childName: orders.childName,
      shohibulName: orders.shohibulName,
      deliveryTimeSlot: orders.deliveryTimeSlot,
      podRecipientName: deliveryTasks.podRecipientName,
      podAt: deliveryTasks.podAt,
      podTempC: deliveryTasks.podTempC,
      podChecklist: deliveryTasks.podChecklist,
    })
    .from(deliveryTasks)
    .leftJoin(orders, eq(deliveryTasks.orderId, orders.id))
    .where(eq(deliveryTasks.trackingToken, token))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    destination: "Alamat penerima terdaftar",
    contactName: null,
    childName: null,
    shohibulName: null,
    podRecipientName: null,
    status: row.status as DeliveryTracking["status"],
  };
}
