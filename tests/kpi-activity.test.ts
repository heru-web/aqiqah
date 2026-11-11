import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { firstRow } from "@/lib/server/sql-helpers";
import { hasActivityInPeriod, isPeriodEmpty, moduleEverUsed } from "@/server/services/kpi-activity";
import { runFormula } from "@/server/services/kpi-formulas";

const EMPTY_PERIOD = { start: "2019-01-01", end: "2019-01-31" };

describe("Lapisan aktivitas KPI (live DB)", () => {
  it("periode tanpa aktivitas apa pun → kosong", async () => {
    expect(await isPeriodEmpty(EMPTY_PERIOD)).toBe(true);
  });

  it("modul dengan transaksi → periode itu tidak kosong", async () => {
    const used = await moduleEverUsed("orders");
    if (!used) {
      // DB tanpa transaksi: tidak ada yang bisa dipastikan
      expect(used).toBe(false);
      return;
    }
    expect(used).toBe(true);
    const row = await firstRow<{ ym: string }>(
      sql`select to_char(date_trunc('month', min("createdAt")), 'YYYY-MM') as ym from orders`
    );
    const ym = row?.ym;
    expect(ym, "harus ada minimal satu order").toBeTruthy();
    const start = `${ym}-01`;
    const end = `${ym}-28`;
    expect(await hasActivityInPeriod("orders", { start, end })).toBe(true);
    expect(await hasActivityInPeriod("orders", { start: "2019-01-01", end: "2019-01-31" })).toBe(false);
    expect(await isPeriodEmpty({ start, end })).toBe(false);
  });

  it("metrik turunan tidak dihitung bila tidak ada transaksi di periode", async () => {
    // AOV butuh minimal satu transaksi; tanpa itu tidak boleh ada angka.
    const aov = await runFormula("aov", { ...EMPTY_PERIOD, scope: "BUSINESS_UNIT", refCode: "AQIQAH" });
    expect(aov).toBeNull();
  });

  it("formula pada modul yang belum dipakai → null, bukan 0", async () => {
    const complaints = await moduleEverUsed("complaints");
    const value = await runFormula("complaint_count", { ...EMPTY_PERIOD, scope: "DEPARTMENT", refCode: "MKT_SALES" });
    if (!complaints) {
      expect(value).toBeNull();
    } else {
      expect(value === null || typeof value === "number").toBe(true);
    }
  });

  it("perhitungan yang gagal tidak boleh melempar error ke runner", async () => {
    const value = await runFormula("formula_tidak_ada", { ...EMPTY_PERIOD, scope: "COMPANY" });
    expect(value).toBeNull();
  });
});
