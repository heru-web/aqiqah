import { imageFormat } from "@/lib/image-upload";
import { describe, expect, it } from "vitest";
import { assertBranchAccess, resolveBranch } from "@/lib/branch-access";
import { payrollNet, requirePassingQc, validateDeliveryTransition, validateStockMove } from "@/server/operational-policy";
import { voucherDiscount } from "@/server/voucher-pricing";
import { getAllowedMenuHrefs } from "@/components/app/nav";
import type { AuthUser } from "@/lib/server/auth";

const user: AuthUser = { id: "user", name: "Test", email: "test@example.test", branchId: "A", permissions: ["orders.orders.view"], roles: [] };

describe("regresi batas akses", () => {
  it("izin baca eksplisit menampilkan menu tetapi izin mutasi saja tidak", () => {
    expect(getAllowedMenuHrefs(user.permissions)).toContain("/orders");
    expect(getAllowedMenuHrefs(["orders.orders.create"])).not.toContain("/orders");
    expect(getAllowedMenuHrefs(["inventory.procurement.view"])).toContain("/suppliers");
  });
  it("menolak cabang berbeda dan cabang kosong tanpa izin global", () => {
    expect(() => assertBranchAccess(user, "B")).toThrow();
    expect(() => assertBranchAccess({ ...user, branchId: null }, null)).toThrow();
    expect(() => assertBranchAccess(user, "A")).not.toThrow();
    expect(() => assertBranchAccess({ ...user, branchId: null, permissions: ["*"] }, "B")).not.toThrow();
    expect(() => resolveBranch(user, "B")).toThrow();
  });
});

describe("regresi aturan operasional", () => {
  it("tidak menerima stok negatif, pecahan, NaN atau arah tidak dikenal", () => {
    for (const qty of [-1, NaN, Infinity, 1.5]) expect(() => validateStockMove("OUT", qty)).toThrow();
    expect(() => validateStockMove("BOGUS", 1)).toThrow();
    expect(() => validateStockMove("ADJUST", 0)).not.toThrow();
  });
  it("QC gagal dan tertunda tidak boleh menjadi siap", () => {
    for (const status of ["FAIL", "PENDING"]) expect(() => requirePassingQc("QC", status)).toThrow();
    expect(() => requirePassingQc("QC", "PASS")).not.toThrow();
  });
  it("payroll final dan komponen negatif ditolak", () => {
    expect(() => payrollNet("FINAL", 100n, 1n, 0n)).toThrow();
    expect(() => payrollNet("DRAFT", 100n, 0n, 101n)).toThrow();
    expect(payrollNet("DRAFT", 100n, 20n, 5n)).toBe(115n);
  });
  it("pesanan batal dan pengiriman lompat tahap ditolak", () => {
    expect(() => validateDeliveryTransition("IN_TRANSIT", "ARRIVED", "CANCELLED")).toThrow();
    expect(() => validateDeliveryTransition("WAITING", "ARRIVED", "READY_DISPATCH")).toThrow();
    expect(() => validateDeliveryTransition("ARRIVED", "WAITING")).toThrow();
    expect(() => validateDeliveryTransition("IN_TRANSIT", "ARRIVED", "READY_DISPATCH")).not.toThrow();
  });
});

it("voucher gratis ongkir dan diskon dibatasi nilai transaksi", () => {
  const v = { isActive: true, startsAt: null, expiresAt: null, maxUsage: 1, usedCount: 0, type: "FREE_DELIVERY", nominalAmount: 0n, percentBps: 0 };
  expect(voucherDiscount(v, 1_000_000n, 25_000n)).toBe(25_000n);
  expect(voucherDiscount({ ...v, type: "NOMINAL", nominalAmount: 2_000_000n }, 1_000_000n, 25_000n)).toBe(1_000_000n);
  expect(() => voucherDiscount({ ...v, usedCount: 1 }, 1_000_000n, 25_000n)).toThrow();
});

it("unggahan HTML tidak boleh menyamar sebagai gambar", () => {
  expect(() => imageFormat(new TextEncoder().encode("<html>payload</html>"))).toThrow();
  expect(imageFormat(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])).mime).toBe("image/png");
});
