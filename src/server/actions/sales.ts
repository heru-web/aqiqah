"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import {
  acceptQuotationAndCreateOrder,
  createQuotation,
  setQuotationStatus,
} from "@/server/services/quotations";
import { createOrder, transitionOrder } from "@/server/services/orders";
import { confirmPayment, registerPayment } from "@/server/services/payments";
import { orderCreateSchema, type OrderCreateRawInput, type QuotationCreateRawInput } from "@/server/schemas";

export type ActionState = { error?: string; success?: boolean; id?: string } | undefined;

function message(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

/* ------------------------------ Quotations -------------------------------- */

export async function createQuotationAction(input: QuotationCreateRawInput): Promise<{ error?: string; id?: string }> {
  const actor = await requirePermission("quotations.quotations.create");
  try {
    if (input.customerId) await assertResourceAccess("customer", input.customerId as string, actor);
    const id = await createQuotation(input, actor);
    revalidatePath("/quotations");
    return { id };
  } catch (err) {
    return { error: message(err, "Gagal membuat penawaran.") };
  }
}

export async function quotationSendAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("quotations.quotations.action");
  await assertResourceAccess("quotation", id, actor);
  try {
    await setQuotationStatus(id, "SENT", actor);
    revalidatePath("/quotations");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal mengirim penawaran.") };
  }
}

export async function quotationAcceptedAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("quotations.quotations.action");
  await assertResourceAccess("quotation", id, actor);
  try {
    await requirePermission("orders.orders.create");
    await acceptQuotationAndCreateOrder(id, actor);
    revalidatePath("/quotations");
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal mengonversi penawaran jadi pesanan.") };
  }
}

export async function quotationVoidAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("quotations.quotations.delete");
  await assertResourceAccess("quotation", id, actor);
  try {
    await setQuotationStatus(id, "VOID", actor);
    revalidatePath("/quotations");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal membatalkan penawaran.") };
  }
}

/* --------------------------------- Order ---------------------------------- */

export async function createOrderAction(input: OrderCreateRawInput): Promise<{ error?: string; id?: string }> {
  const actor = await requirePermission("orders.orders.create");
  try {
    if (input.customerId) await assertResourceAccess("customer", input.customerId as string, actor);
    const id = await createOrder(input, actor);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { id };
  } catch (err) {
    return { error: message(err, "Gagal membuat pesanan.") };
  }
}

export async function transitionOrderAction(
  orderId: string,
  to: string,
  reason?: string
): Promise<{ error?: string }> {
  const actor = await requirePermission("orders.status.update");
  await assertResourceAccess("order", orderId, actor);
  try {
    await transitionOrder(
      { orderId, toStatus: to as "ORDER_CONFIRMED" | "ANIMALS_SIAAP" | "SLAUGHTERED" | "KARKAS_FILLET" | "KITCHEN_COOKED" | "PACKED" | "QC_READY" | "READY_DISPATCH" | "DELIVERED" | "COMPLETED" | "CANCELLED", reason },
      actor
    );
    revalidatePath("/orders");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal memperbarui status pesanan.") };
  }
}

/* -------------------------------- Payments -------------------------------- */

export async function registerPaymentAction(
  input: {
    invoiceId?: string;
    orderId?: string;
    customerId?: string;
    amount: string;
    method: "TRANSFER" | "VA" | "QRIS" | "EWALLET" | "CASH" | "CARD";
    provider?: string;
    providerRef?: string;
    bankFrom?: string;
    bankTo?: string;
    senderName?: string;
    notes?: string;
    confirmNow?: boolean;
  }
): Promise<{ error?: string; id?: string }> {
  const actor = await requirePermission("payments.payments.create");
  try {
    if (input.orderId) await assertResourceAccess("order", input.orderId as string, actor);
    if (input.invoiceId) await assertResourceAccess("invoice", input.invoiceId as string, actor);
    if (input.customerId) await assertResourceAccess("customer", input.customerId as string, actor);
    if (input.confirmNow) await requirePermission("payments.payments.action");
    const id = await registerPayment(input, actor);
    revalidatePath("/payments");
    return { id };
  } catch (err) {
    return { error: message(err, "Gagal mencatat pembayaran.") };
  }
}

export async function confirmPaymentAction(
  paymentId: string,
  status: "CONFIRMED" | "FAILED",
  notes?: string
): Promise<{ error?: string }> {
  const actor = await requirePermission("payments.payments.action");
  await assertResourceAccess("payment", paymentId, actor);
  try {
    await confirmPayment({ paymentId, status, notes }, actor);
    revalidatePath("/payments");
    revalidatePath("/invoices");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal mengonfirmasi pembayaran.") };
  }
}
/** The same snapshots and voucher calculation used when persisting the order. */
export async function previewOrderPricingAction(input: Pick<OrderCreateRawInput, "items" | "shippingAmount" | "voucherCode">): Promise<{
  error?: string; itemsTotal?: string; discount?: string; shipping?: string; total?: string;
}> {
  const actor = await requirePermission("orders.orders.create");
  try {
    const parsed = orderCreateSchema.pick({ items: true, shippingAmount: true, voucherCode: true }).parse(input);
    const { previewOrderPricing } = await import("@/server/services/order-pricing");
    return await previewOrderPricing(parsed, actor);
  } catch (err) {
    return { error: message(err, "Gagal menghitung harga pesanan.") };
  }
}
