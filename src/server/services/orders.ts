import "server-only";
import { voucherDiscount } from "@/server/voucher-pricing";
import { resolveBranch } from "@/lib/branch-access";
import { assertResourceAccess } from "@/lib/server/resource-access";
import { createOpsFlowFromOrder } from "@/server/services/erp";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  deliveries,
  invoices,
  orderItems,
  orders,
  orderStatusLogs,
  voucherRedemptions,
  vouchers,
} from "@/db/schema";
import { orderLifecycle } from "@/db/schema/sales";
import { ConflictError, InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit, type Tx } from "@/lib/server/audit";
import { createInAppNotification } from "@/lib/server/notifications";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";
import { orderCreateSchema, orderTransitionSchema, type OrderCreateRawInput, type OrderTransitionInput, type LineItemInput } from "@/server/schemas";
import { computeTotals } from "@/server/pricing";
import { copyOrderItemsToInvoice, issueInvoiceFromOrder } from "@/server/services/invoices";
import { snapshotPrices } from "@/server/services/products";
import { registerPayment } from "@/server/services/payments";

const TERMINAL = new Set(["COMPLETED", "CANCELLED"]);

export async function createOrder(input: OrderCreateRawInput, actor: AuthUser): Promise<string> {
  const parsed = orderCreateSchema.parse(input);
  const branchId = resolveBranch(actor, parsed.branchId);
  if (!branchId) throw new ConflictError("Branch belum diatur untuk user.");

  return db.transaction(async (tx) => {
    await assertResourceAccess("customer", parsed.customerId, { ...actor, branchId }, tx);
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

    // Voucher (potongan tambahan, dicatat terpisah)
    let voucherDiscount = 0n;
    let voucherId: string | null = null;
    if (parsed.voucherCode) {
      const applied = await applyVoucher(tx, parsed.voucherCode, totals.itemsTotal - totals.discountAmount, actor, totals.shippingAmount);
      voucherDiscount = applied.discount;
      voucherId = applied.voucherId;
    }

    const grandTotal = totals.total - voucherDiscount;
    if (parsed.expectedTotal !== undefined && parsed.expectedTotal !== grandTotal) throw new ConflictError("Harga berubah. Periksa ulang ringkasan sebelum membuat pesanan.");
    const totalDiscount = totals.discountAmount + voucherDiscount;
    const orderNumber = await nextSequentialNumber("ORD", { pad: 4 }, tx);

    const [order] = await tx
      .insert(orders)
      .values({
        branchId,
        orderNumber,
        customerId: parsed.customerId,
        quoteId: parsed.quoteId ?? null,
        status: "ORDER_CONFIRMED",
        aqiqahType: parsed.aqiqahType,
        shohibulName: parsed.shohibulName ?? null,
        shohibulGender: parsed.shohibulGender ?? null,
        childName: parsed.childName ?? null,
        bornDate: parsed.bornDate ?? null,
        aqiqahDay: parsed.aqiqahDay ?? null,
        aqiqahDate: parsed.aqiqahDate ?? null,
        deliveryDate: parsed.deliveryDate ?? null,
        deliveryTimeSlot: parsed.deliveryTimeSlot ?? null,
        recipientName: parsed.recipientName ?? null,
        recipientPhone: parsed.recipientPhone ?? null,
        deliveryAddress: parsed.deliveryAddress ?? null,
        deliveryCity: parsed.deliveryCity ?? null,
        deliveryDistrict: parsed.deliveryDistrict ?? null,
        deliveryLandmark: parsed.deliveryLandmark ?? null,
        gpsCoordinates: parsed.gpsCoordinates ?? null,
        deliveryNote: parsed.deliveryNote ?? null,
        total: grandTotal,
        itemsTotal: totals.itemsTotal,
        discountAmount: totalDiscount,
        shippingAmount: totals.shippingAmount,
        rounding: totals.rounding,
        paidConfirmed: 0n,
        balance: grandTotal,
        voucherId,
        channel: parsed.channel ?? null,
        referralSource: parsed.referralSource ?? null,
        notes: parsed.notes ?? null,
        createdBy: actor.id,
      })
      .returning();

    for (const l of lines) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        kind: l.item.kind,
        entityId: l.item.entityId ?? null,
        variantId: l.item.variantId ?? null,
        description: l.description,
        quantity: l.item.quantity,
        unitPrice: l.unitPrice,
        discountBps: l.item.discountBps,
        lineTotal: lineTotalOf(l.unitPrice, l.item.quantity, l.item.discountBps),
      });
    }

    if (voucherId) {
      await tx.insert(voucherRedemptions).values({ voucherId, orderId: order.id, amount: voucherDiscount });
    }

    await tx.insert(orderStatusLogs).values({
      orderId: order.id,
      toStatus: "ORDER_CONFIRMED",
      changedBy: actor.id,
      reason: "Order dibuat (akad sah).",
    });

    // Invoice + jurnal SALES otomatis
    const invoiceId = await issueInvoiceFromOrder(
      {
        id: order.id,
        branchId,
        customerId: parsed.customerId,
        itemsTotal: totals.itemsTotal,
        discountAmount: totalDiscount,
        shippingAmount: totals.shippingAmount,
        rounding: totals.rounding,
        total: grandTotal,
        paidConfirmed: 0n,
      },
      actor,
      tx
    );
    await copyOrderItemsToInvoice(invoiceId, order.id, tx);

    await insertAudit(tx, {
      actor,
      action: "CREATE",
      module: "orders",
      entityType: "order",
      entityId: order.id,
      after: { orderNumber, total: grandTotal.toString(), items: lines.map((l) => l.description) },
    });

    if (parsed.confirmImmediately) {
      await registerPayment(
        {
          branchId,
          invoiceId,
          orderId: order.id,
          customerId: parsed.customerId,
          amount: grandTotal.toString(),
          method: "TRANSFER",
          notes: "DP / pelunasan saat pembuatan order (wizard)",
        },
        actor,
        { exec: tx }
      );
    }

    await createInAppNotification({
      userId: null,
      branchId,
      title: `Order baru: ${orderNumber}`,
      body: `Total ${grandTotal.toLocaleString("id-ID")}`,
      data: { orderId: order.id },
    }, tx);

    // Wire: otomatis buat batch produksi + tugas pengiriman
    await createOpsFlowFromOrder(
        {
          id: order.id,
          branchId,
          orderNumber,
          shohibulName: (order.shohibulName as string | null) ?? null,
          recipientName: (order.recipientName as string | null) ?? null,
          recipientPhone: (order.recipientPhone as string | null) ?? null,
          deliveryAddress: (order.deliveryAddress as string | null) ?? null,
          deliveryCity: (order.deliveryCity as string | null) ?? null,
          deliveryDate: (order.deliveryDate as Date | null) ?? null,
          deliveryTimeSlot: (order.deliveryTimeSlot as string | null) ?? null,
        },
        actor.id,
        tx
      );


    return order.id;
  });
}

async function applyVoucher(tx: Tx, code: string, itemsTotal: bigint, actor: AuthUser, shipping = 0n): Promise<{ voucherId: string; discount: bigint }> {
  const rows = await tx.select().from(vouchers).where(eq(vouchers.code, code)).limit(1).for("update");
  if (rows.length === 0) throw new NotFoundError("Kode voucher tidak ditemukan.");
  const v = rows[0];

  const discount = voucherDiscount(v, itemsTotal, shipping);

  await tx.update(vouchers).set({ usedCount: v.usedCount + 1 }).where(eq(vouchers.id, v.id));
  await insertAudit(tx, {
    actor,
    action: "UPDATE",
    module: "orders",
    entityType: "voucher",
    entityId: v.id,
    after: { discount: discount.toString(), usedCount: v.usedCount + 1 },
  });
  return { voucherId: v.id, discount };
}

function lineTotalOf(unitPrice: bigint, qty: number, bps: number): bigint {
  const gross = unitPrice * BigInt(qty);
  if (bps <= 0) return gross;
  return gross - (gross * BigInt(bps)) / 10000n;
}

export interface QuotationOrderSource {
  quoteId: string;
  customerId: string;
  branchId: string;
  actor: AuthUser;
  items: LineItemInput[];
  shippingAmount: bigint;
  total: bigint;
  rounding: bigint;
  itemsTotal: bigint;
  discountAmount: bigint;
}

export async function createOrderFromQuotation(src: QuotationOrderSource): Promise<string> {
  const { quoteId, customerId, branchId, actor, items, shippingAmount, total, rounding, itemsTotal, discountAmount } = src;

  return db.transaction(async (tx) => {
    const orderNumber = await nextSequentialNumber("ORD", { pad: 4 }, tx);
    const [order] = await tx
      .insert(orders)
      .values({
        branchId,
        orderNumber,
        customerId,
        quoteId,
        status: "ORDER_CONFIRMED",
        total,
        itemsTotal,
        discountAmount,
        shippingAmount,
        rounding,
        paidConfirmed: 0n,
        balance: total,
        notes: `Dibuat dari penawaran ${quoteId}`,
        createdBy: actor.id,
      })
      .returning();

    for (const item of items) {
      await tx.insert(orderItems).values({
        orderId: order.id,
        kind: item.kind,
        entityId: item.entityId ?? null,
        variantId: item.variantId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountBps: item.discountBps,
        lineTotal: lineTotalOf(item.unitPrice, item.quantity, item.discountBps),
      });
    }

    await tx.insert(orderStatusLogs).values({
      orderId: order.id,
      toStatus: "ORDER_CONFIRMED",
      changedBy: actor.id,
      reason: "Order dari penawaran yang diterima.",
    });

    const invoiceId = await issueInvoiceFromOrder(
      { id: order.id, branchId, customerId, itemsTotal, discountAmount, shippingAmount, rounding, total, paidConfirmed: 0n },
      actor,
      tx
    );
    await copyOrderItemsToInvoice(invoiceId, order.id, tx);

    await insertAudit(tx, {
      actor,
      action: "CREATE",
      module: "orders",
      entityType: "order",
      entityId: order.id,
      after: { orderNumber, total: total.toString(), fromQuote: quoteId },
    });
    return order.id;
  });
}

const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ["ORDER_CONFIRMED", "CANCELLED"],
  ORDER_CONFIRMED: ["ANIMALS_SIAAP", "CANCELLED"],
  ANIMALS_SIAAP: ["SLAUGHTERED", "CANCELLED"],
  SLAUGHTERED: ["KARKAS_FILLET", "CANCELLED"],
  KARKAS_FILLET: ["KITCHEN_COOKED", "CANCELLED"],
  KITCHEN_COOKED: ["PACKED", "CANCELLED"],
  PACKED: ["QC_READY", "CANCELLED"],
  QC_READY: ["READY_DISPATCH", "CANCELLED"],
  READY_DISPATCH: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Transisi status order (linear maju; CANCELLED dari mana saja sebelum terminal). */
export async function transitionOrder(input: OrderTransitionInput, actor: AuthUser): Promise<string> {
  const parsed = orderTransitionSchema.parse(input);
  const order = await requireOrder(parsed.orderId);

  if (TERMINAL.has(order.status)) throw new InvalidOperationError(`Order ${order.status} tidak bisa diubah statusnya.`);
  if (parsed.toStatus !== "CANCELLED" && !NEXT_STATUS[order.status]?.includes(parsed.toStatus)) {
    throw new InvalidOperationError(`Transisi ${order.status} → ${parsed.toStatus} tidak diizinkan.`);
  }

  return db.transaction(async (tx) => {
    await tx.update(orders).set({ status: parsed.toStatus }).where(eq(orders.id, parsed.orderId));
    await tx.insert(orderStatusLogs).values({
      orderId: parsed.orderId,
      fromStatus: order.status,
      toStatus: parsed.toStatus,
      changedBy: actor.id,
      reason: parsed.reason ?? null,
    });

    if (parsed.toStatus === "READY_DISPATCH") {
      const existing = await tx.select().from(deliveries).where(eq(deliveries.orderId, parsed.orderId)).limit(1);
      if (existing.length === 0) {
        const deliveryNumber = await nextSequentialNumber("DLV", { pad: 4 });
        await tx.insert(deliveries).values({
          branchId: order.branchId,
          deliveryNumber,
          orderId: parsed.orderId,
          status: "WAITING",
          scheduledDate: order.deliveryDate,
          scheduledTimeSlot: order.deliveryTimeSlot,
        });
      }
    }

    await insertAudit(tx, {
      actor,
      action: "TRANSITION",
      module: "orders",
      entityType: "order",
      entityId: parsed.orderId,
      before: { status: order.status },
      after: { status: parsed.toStatus, reason: parsed.reason },
    });

    await createInAppNotification({
      userId: null,
      branchId: order.branchId,
      title: `Order ${order.orderNumber} → ${parsed.toStatus}`,
      body: parsed.reason ?? undefined,
      data: { orderId: parsed.orderId },
    });

    return parsed.orderId;
  });
}

export async function getOrderDetail(id: string) {
  const order = await requireOrder(id);
  const [customer, items, statusLogs, invoice] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.createdAt),
    db.select().from(orderStatusLogs).where(eq(orderStatusLogs.orderId, id)).orderBy(orderStatusLogs.createdAt),
    db.select().from(invoices).where(eq(invoices.orderId, id)).orderBy(invoices.createdAt).limit(1),
  ]);
  return { order, customer: customer[0] ?? null, items, statusLogs, invoice: invoice[0] ?? null };
}

export async function listOrders(opts: { branchId?: string; status?: string; search?: string; page?: number; pageSize?: number; upcomingOnly?: boolean } = {}) {
  const { status, search, page = 1, pageSize = 20, upcomingOnly } = opts;
  const conditions = [];
  if (opts.branchId) conditions.push(eq(orders.branchId, opts.branchId));
  if (status && status !== "ALL") conditions.push(eq(orders.status, status as (typeof orders.$inferSelect)["status"]));
  if (search) conditions.push(sql`(${orders.orderNumber} ILIKE ${`%${search}%`} OR ${orders.shohibulName} ILIKE ${`%${search}%`})`);
  if (upcomingOnly) conditions.push(gt(orders.deliveryDate, new Date()));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      balance: orders.balance,
      paidConfirmed: orders.paidConfirmed,
      deliveryDate: orders.deliveryDate,
      createdAt: orders.createdAt,
      shohibulName: orders.shohibulName,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count: total }] = await db.select({ count: count() }).from(orders).where(where);
  return { rows, total: Number(total), page, pageSize };
}

export async function orderCounts(branchId?: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(branchId ? eq(orders.branchId, branchId) : undefined)
    .groupBy(orders.status);
  const result: Record<string, number> = {};
  for (const s of [...orderLifecycle, "DRAFT", "CANCELLED"]) result[s] = 0;
  for (const r of rows) result[r.status] = Number(r.count);
  return result;
}

export async function requireOrder(id: string) {
  const row = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Order tidak ditemukan.");
  return row[0];
}