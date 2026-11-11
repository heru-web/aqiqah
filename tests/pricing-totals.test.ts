import { describe, expect, it } from "vitest";
import { clampPaymentAmount, computeBalance, computeTotals, discountOf, lineTotal } from "@/server/pricing";

describe("Kalkulasi keuangan — diskon & total pesanan", () => {
  it("menghitung diskon per baris dari basis point", () => {
    expect(discountOf(100_000n, 500)).toBe(5_000n); // 5%
    expect(discountOf(100_000n, 0)).toBe(0n);
    expect(discountOf(0n, 1_000)).toBe(0n);
  });

  it("menghitung line total dengan diskon baris", () => {
    expect(lineTotal({ unitPrice: 100_000n, quantity: 3, discountBps: 0 })).toBe(300_000n);
    expect(lineTotal({ unitPrice: 100_000n, quantity: 3, discountBps: 1_000 })).toBe(270_000n); // diskon 10%
    expect(lineTotal({ unitPrice: 100_000n, quantity: 3, isFree: true })).toBe(0n);
  });

  it("menjumlahkan item, diskon global, ongkir, dan pembulatan", () => {
    const totals = computeTotals(
      [
        { unitPrice: 100_000n, quantity: 3, discountBps: 0 },
        { unitPrice: 50_000n, quantity: 2, discountBps: 0 },
      ],
      { shippingAmount: 50_000n, roundingModulus: 5_000n }
    );
    // items = 300.000 + 100.000 = 400.000; shipping 50.000; sebelum pembulatan 450.000 (kelipatan 5.000)
    expect(totals.itemsTotal).toBe(400_000n);
    expect(totals.shippingAmount).toBe(50_000n);
    expect(totals.rounding).toBe(0n);
    expect(totals.total).toBe(450_000n);

    const rounded = computeTotals([{ unitPrice: 100_000n, quantity: 3, discountBps: 0 }], { shippingAmount: 0n, roundingModulus: 5_000n });
    // sebelum pembulatan 300.000, sisa 0 → tidak perlu pembulatan
    expect(rounded.total).toBe(300_000n);
    expect(rounded.rounding).toBe(0n);

    const roundedUp = computeTotals([{ unitPrice: 100_000n, quantity: 3, discountBps: 0 }], { shippingAmount: 100n, roundingModulus: 5_000n });
    // sebelum pembulatan 300.100 → pembulatan ke atas ke 305.000
    expect(roundedUp.rounding).toBe(4_900n);
    expect(roundedUp.total).toBe(305_000n);
  });

  it("menjumlahkan diskon global (basis point) di atas item per baris", () => {
    const totals = computeTotals(
      [{ unitPrice: 100_000n, quantity: 3, discountBps: 0 }],
      { discountBps: 1_000, shippingAmount: 0n }
    );
    expect(totals.itemsTotal).toBe(300_000n);
    expect(totals.discountAmount).toBe(30_000n); // 10%
    expect(totals.total).toBe(270_000n);
  });

  it("balance total dikurangi pembayaran terkonfirmasi, dipotong minimum 0", () => {
    expect(computeBalance(1_000_000n, 300_000n)).toEqual({ total: 1_000_000n, paidConfirmed: 300_000n, balance: 700_000n });
    expect(computeBalance(100_000n, 150_000n).balance).toBe(0n);
  });

  it("membatasi nominal pembayaran agar tidak melebihi saldo", () => {
    expect(clampPaymentAmount(150_000n, 100_000n)).toBe(100_000n);
    expect(clampPaymentAmount(100_000n, 100_000n)).toBe(100_000n);
    expect(clampPaymentAmount(50_000n, 0n)).toBe(0n);
  });
});
