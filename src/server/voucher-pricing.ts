import { InvalidOperationError } from "@/lib/errors";

export interface VoucherPrice {
  isActive: boolean; startsAt: Date | null; expiresAt: Date | null;
  maxUsage: number | null; usedCount: number; type: string; nominalAmount: bigint; percentBps: number;
}

export function voucherDiscount(v: VoucherPrice, itemsTotal: bigint, shipping: bigint, now = new Date()): bigint {
  if (!v.isActive) throw new InvalidOperationError("Voucher nonaktif.");
  if (v.startsAt && v.startsAt > now) throw new InvalidOperationError("Voucher belum berlaku.");
  if (v.expiresAt && v.expiresAt < now) throw new InvalidOperationError("Voucher sudah kedaluwarsa.");
  if (v.maxUsage !== null && v.usedCount >= v.maxUsage) throw new InvalidOperationError("Kuota voucher habis.");
  if (v.type === "FREE_DELIVERY") return shipping;
  const value = v.type === "PERCENT" ? itemsTotal * BigInt(v.percentBps) / 10000n : v.nominalAmount;
  return value > itemsTotal ? itemsTotal : value;
}
