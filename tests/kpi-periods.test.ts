import { describe, expect, it } from "vitest";
import { jakartaToday, monthRange, weekRange } from "@/server/services/kpi-runner";

describe("KPI runner — rentang periode", () => {
  it("jakartaToday berformat YYYY-MM-DD", () => {
    expect(jakartaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("weekRange Senin–Minggu yang memuat tanggal acuan", () => {
    expect(weekRange("2026-11-08")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(weekRange("2026-11-02")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(weekRange("2026-11-09")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  it("monthRange hari pertama s.d. hari terakhir bulan", () => {
    expect(monthRange("2026-02-15")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2024-02-10")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange("2026-12-01")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
