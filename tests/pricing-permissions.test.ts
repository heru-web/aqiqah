import { describe, expect, it } from "vitest";
import { computeBalance, computeTotals, discountOf, lineTotal } from "@/server/pricing";
import { can, canAll, canAny, isKnownPermission } from "@/lib/permissions";

describe("lineTotal & discountOf", () => {
  it("diskon dalam basis point (100 = 1%)", () => {
    expect(discountOf(1_000_000n, 100)).toBe(10_000n);
    expect(discountOf(1_000_000n, 0)).toBe(0n);
    expect(discountOf(0n, 500)).toBe(0n);
  });

  it("lineTotal = gross - diskon; gratis = 0", () => {
    expect(lineTotal({ unitPrice: 500_000n, quantity: 2, discountBps: 0 })).toBe(1_000_000n);
    expect(lineTotal({ unitPrice: 1_000_000n, quantity: 1, discountBps: 500, isFree: true })).toBe(0n);
  });
});

describe("computeTotals", () => {
  it("Total = Subtotal - Diskon + Ongkir + Pembulatan", () => {
    const t = computeTotals(
      [
        { unitPrice: 2_000_000n, quantity: 1, discountBps: 0 },
        { unitPrice: 500_000n, quantity: 2, discountBps: 500 },
      ],
      { shippingAmount: 25_000n }
    );
    expect(t.itemsTotal).toBe(3_000_000n);
    expect(t.discountAmount).toBe(50_000n);
    expect(t.shippingAmount).toBe(25_000n);
    expect(t.total).toBe(2_975_000n);
    expect(t.rounding).toBe(0n);
  });

  it("pembulatan ke atas ke kelipatan modulus", () => {
    const t = computeTotals([{ unitPrice: 10_250n, quantity: 1, discountBps: 0 }], { roundingModulus: 500n });
    expect(t.total).toBe(10_500n);
    expect(t.rounding).toBe(250n);
  });

  it("tidak pernah negatif saat diskon > subtotal", () => {
    const t = computeTotals([{ unitPrice: 100_000n, quantity: 1, discountBps: 0 }], { discountBps: 10000 });
    expect(t.total).toBe(0n);
  });
});

describe("computeBalance & clamp", () => {
  it("balance = total - paid, minimal 0", () => {
    expect(computeBalance(1_000_000n, 400_000n).balance).toBe(600_000n);
    expect(computeBalance(1_000_000n, 1_200_000n).balance).toBe(0n);
  });
});

describe("RBAC can/canAny/canAll", () => {
  it("wildcard penuh", () => {
    expect(can(["*"], "orders.orders.view")).toBe(true);
  });

  it("wildcard per modul", () => {
    expect(can(["orders.*"], "orders.orders.create")).toBe(true);
    expect(can(["orders.orders.*"], "orders.orders.update")).toBe(true);
  });

  it("permission eksplisit", () => {
    expect(can(["orders.orders.view"], "orders.orders.view")).toBe(true);
    expect(can(["orders.orders.view"], "orders.orders.delete")).toBe(false);
  });

  it("canAny / canAll", () => {
    const perms = ["crm.pipeline.view", "orders.orders.view"];
    expect(canAny(perms, ["sales.banana", "crm.pipeline.view"])).toBe(true);
    expect(canAll(perms, ["crm.pipeline.view", "orders.orders.view"])).toBe(true);
    expect(canAll(perms, ["crm.pipeline.view", "billing.x"])).toBe(false);
  });

  it("hanya permission terdaftar yang dianggap dikenal", () => {
    expect(isKnownPermission("orders.orders.view")).toBe(true);
    expect(isKnownPermission("foo.bar.baz")).toBe(false);
  });
});