/**
 * Kalkulasi finansial pesanan/penawaran — satu-satunya sumber kebenaran.
 * Rumus: Total = Subtotal − Diskon + Ongkir + Pembulatan.
 * Uang: bigint integer rupiah, tanpa desimal. Persen: basis point (100 = 1%).
 */

import { ZERO } from "@/lib/money";

export interface PriceLineInput {
  unitPrice: bigint;
  quantity: number;
  discountBps?: number; // 100 = 1%
  isFree?: boolean;
}

export interface Totals {
  itemsTotal: bigint;
  discountAmount: bigint;
  shippingAmount: bigint;
  rounding: bigint; // sisa agar total menjadi kelipatan modulus
  total: bigint;
}

/** Diskon dari harga per baris/global. BPS: 100 = 1%. */
export function discountOf(base: bigint, bps: number): bigint {
  if (bps <= 0 || base <= 0n) return 0n;
  return (base * BigInt(bps)) / 10000n;
}

export function lineTotal(input: PriceLineInput): bigint {
  if (input.isFree) return 0n;
  const gross = input.unitPrice * BigInt(input.quantity);
  return gross - discountOf(gross, input.discountBps ?? 0);
}

/**
 * Hitung total pesanan. Pembulatan opsional (modulus rupiah, mis. 500)
 * dan dipisah agar transparan. Sign concurrency: input array item-isFree
 * dipertanggungjawabkan oleh pemanggil (snapshot harga).
 */
export function computeTotals(
  lines: PriceLineInput[],
  opts: { shippingAmount?: bigint; discountBps?: number; roundingModulus?: bigint } = {}
): Totals {
  const shipping = BigInt(opts.shippingAmount ?? 0);
  let itemsTotal = 0n;
  let discountAmount = 0n;
  for (const l of lines) {
    if (l.isFree) continue;
    const gross = l.unitPrice * BigInt(l.quantity);
    const disc = discountOf(gross, l.discountBps ?? 0);
    itemsTotal += gross;
    discountAmount += disc;
  }
  const globalBps = opts.discountBps ?? 0;
  if (globalBps > 0) {
    const extraDisc = discountOf(itemsTotal, globalBps);
    discountAmount += extraDisc;
  }
  let subtotal = itemsTotal - discountAmount;
  if (subtotal < 0n) subtotal = 0n;
  const beforeRounding = subtotal + shipping;
  const mod = BigInt(opts.roundingModulus ?? 0);
  let rounding = 0n;
  let total = beforeRounding;
  if (mod > 0n) {
    const rem = beforeRounding % mod;
    if (rem !== 0n) {
      rounding = mod - rem; // selalu bulatkan ke atas ke kelipatan modulus
      total = beforeRounding + rounding;
    }
  }
  return { itemsTotal, discountAmount, shippingAmount: shipping, rounding, total };
}

export interface BalanceResult {
  total: bigint;
  paidConfirmed: bigint;
  balance: bigint;
}

/** Balance = Total − Pembayaran terkonfirmasi. */
export function computeBalance(total: bigint, paidConfirmed: bigint): BalanceResult {
  const balance = total - paidConfirmed;
  return { total, paidConfirmed, balance: balance < 0n ? 0n : balance };
}

/** Sisa yang boleh dibayar di luar invoice yang sudah di-issue. */
export function clampPaymentAmount(paymentAmount: bigint, currentBalance: bigint): bigint {
  const maxAmt = currentBalance < 0n ? ZERO : currentBalance;
  return paymentAmount > maxAmt ? maxAmt : paymentAmount;
}