import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vouchers } from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";
import { NotFoundError } from "@/lib/errors";
import type { LineItemInput } from "@/server/schemas";
import { snapshotPrices } from "./products";
import { computeTotals } from "@/server/pricing";
import { voucherDiscount } from "@/server/voucher-pricing";

export async function previewOrderPricing(input: { items: LineItemInput[]; shippingAmount?: bigint; voucherCode?: string }, actor: AuthUser) {
  const snapshots = await snapshotPrices(input.items, actor);
  const totals = computeTotals(input.items.map((item, i) => ({ ...item, unitPrice: snapshots[i].unitPrice })), { shippingAmount: input.shippingAmount });
  let promo = 0n;
  if (input.voucherCode) {
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.code, input.voucherCode)).limit(1);
    if (!voucher) throw new NotFoundError("Kode voucher tidak ditemukan.");
    promo = voucherDiscount(voucher, totals.itemsTotal - totals.discountAmount, totals.shippingAmount);
  }
  return { itemsTotal: totals.itemsTotal.toString(), discount: (totals.discountAmount + promo).toString(), shipping: totals.shippingAmount.toString(), total: (totals.total - promo).toString() };
}
