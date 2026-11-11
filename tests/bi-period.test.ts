import { describe, expect, it } from "vitest";
import { monthKeys, monthLabel, monthStart } from "@/lib/bi-period";

describe("periode BI", () => {
  it("membuat 12 kunci bulan berakhir pada bulan berjalan", () => {
    const keys = monthKeys(12, new Date("2026-11-08T00:00:00Z"));
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2025-12");
    expect(keys[11]).toBe("2026-11");
  });

  it("menangani pergantian tahun", () => {
    expect(monthKeys(3, new Date("2026-02-15T00:00:00Z"))).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("label dan awal bulan konsisten", () => {
    expect(monthLabel("2026-01")).toBe("Jan 26");
    expect(monthStart("2026-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
