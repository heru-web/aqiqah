import { describe, expect, it } from "vitest";
import { bpsOf, formatRupiahFull, formatRupiahShort, parseBPS, parseIDR, percentOfBPS } from "@/lib/money";

describe("parseIDR", () => {
  it("mem-parsing string input rupiah penuh", () => {
    expect(parseIDR("1.500.000")).toBe(1_500_000n);
    expect(parseIDR("Rp 3.000.000")).toBe(3_000_000n);
    expect(parseIDR("47500")).toBe(47_500n);
    expect(parseIDR("0")).toBe(0n);
    expect(parseIDR(1200)).toBe(1_200n);
    expect(parseIDR(null)).toBe(0n);
    expect(parseIDR("")).toBe(0n);
  });

  it("menolak nilai tidak valid", () => {
    expect(() => parseIDR("abc")).toThrowError("Nilai rupiah tidak valid.");
    expect(() => parseIDR("-500")).toThrowError();
  });
});

describe("parseBPS", () => {
  it("mengubah persen ke basis point (100 = 1%)", () => {
    expect(parseBPS(1)).toBe(100);
    expect(parseBPS(5)).toBe(500);
    expect(parseBPS("10,5")).toBe(1050);
    expect(parseBPS(0)).toBe(0);
  });

  it("menolak di luar rentang 0–100", () => {
    expect(() => parseBPS(150)).toThrowError();
    expect(() => parseBPS(-1)).toThrowError();
  });
});

describe("formatRupiah", () => {
  it("format penuh dengan titik ribuan", () => {
    expect(formatRupiahFull(1_250_000n)).toBe("Rp 1.250.000");
    expect(formatRupiahFull(99)).toBe("Rp 99");
  });

  it("format singkat", () => {
    expect(formatRupiahShort(500n)).toBe("500");
    expect(formatRupiahShort(12_000n)).toBe("12 rb");
    expect(formatRupiahShort(2_500_000n)).toBe("2,5 jt");
    expect(formatRupiahShort(1_500_000_000n)).toBe("1,5 M");
  });
});

describe("percentOfBPS", () => {
  it("menghitung nilai dari basis point", () => {
    expect(percentOfBPS(100_000n, 500)).toBe(5_000n); // 5%
    expect(percentOfBPS(100_000n, 0)).toBe(0n);
  });

  it("bpsOf membalik persen ke basis point", () => {
    expect(bpsOf(250)).toBe(2.5);
  });
});