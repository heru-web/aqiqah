import { describe, expect, it } from "vitest";
import {
  GRADE_LABEL,
  MIN_SCORE_COVERAGE,
  attendanceScore,
  calcCoverage,
  calcIndividualScore,
  calcScore,
  calcWeightedScore,
  disciplineScore,
  gradeFromScore,
  growthPercent,
  hasEnoughCoverage,
  safePercent,
  safeRatio,
} from "@/lib/score-engine";

describe("calcScore", () => {
  it("menghitung proporsi target untuk HIGHER_BETTER", () => {
    expect(calcScore(80, 100, "HIGHER_BETTER")).toBe(80);
    expect(calcScore(100, 100, "HIGHER_BETTER")).toBe(100);
    expect(calcScore(110, 100, "HIGHER_BETTER")).toBe(110);
  });

  it("membalik rasio untuk LOWER_BETTER", () => {
    expect(calcScore(50, 100, "LOWER_BETTER")).toBe(120);
    expect(calcScore(100, 100, "LOWER_BETTER")).toBe(100);
    expect(calcScore(200, 100, "LOWER_BETTER")).toBe(50);
  });

  it("membatasi skor 0–120", () => {
    expect(calcScore(500, 100, "HIGHER_BETTER")).toBe(120);
    expect(calcScore(0, 100, "HIGHER_BETTER")).toBe(0);
    expect(calcScore(-10, 100, "HIGHER_BETTER")).toBe(0);
  });

  it("menangani target nol dan aktual non-finit", () => {
    expect(calcScore(10, 0, "HIGHER_BETTER")).toBe(0);
    expect(calcScore(10, 0, "LOWER_BETTER")).toBe(0);
    expect(calcScore(Number.NaN, 100, "HIGHER_BETTER")).toBe(0);
  });

  it("LOWER_BETTER aktual nol memperoleh skor maksimum", () => {
    expect(calcScore(0, 50, "LOWER_BETTER")).toBe(120);
  });

  it("membulatkan 2 desimal", () => {
    expect(calcScore(1, 3, "HIGHER_BETTER")).toBe(33.33);
  });
});

describe("calcWeightedScore", () => {
  it("merata-ratakan tertimbang", () => {
    expect(calcWeightedScore([{ score: 100, weight: 60 }, { score: 80, weight: 40 }])).toBe(92);
  });

  it("mengabaikan bobot nol dan mengembalikan 0 bila total bobot 0", () => {
    expect(calcWeightedScore([{ score: 100, weight: 0 }])).toBe(0);
    expect(calcWeightedScore([])).toBe(0);
  });

  it("membulatkan 2 desimal", () => {
    expect(calcWeightedScore([{ score: 70, weight: 1 }, { score: 100, weight: 2 }])).toBe(90);
    expect(calcWeightedScore([{ score: 1, weight: 3 }, { score: 2, weight: 3 }])).toBe(1.5);
  });
});

describe("gradeFromScore", () => {
  it("batas grade A/B/C/D", () => {
    expect(gradeFromScore(90)).toBe("A");
    expect(gradeFromScore(89.99)).toBe("B");
    expect(gradeFromScore(80)).toBe("B");
    expect(gradeFromScore(79.99)).toBe("C");
    expect(gradeFromScore(70)).toBe("C");
    expect(gradeFromScore(69.99)).toBe("D");
    expect(gradeFromScore(0)).toBe("D");
  });

  it("memiliki label Indonesia untuk setiap grade", () => {
    expect(GRADE_LABEL.A).toBe("Sangat Baik");
    expect(GRADE_LABEL.D).toBe("Perlu Perbaikan");
  });
});

describe("calcIndividualScore", () => {
  it("memakai bobot default 60/15/15/10", () => {
    expect(calcIndividualScore({ kpi: 100, sop: 100, attendance: 100, discipline: 100 })).toBe(100);
    expect(calcIndividualScore({ kpi: 0, sop: 0, attendance: 0, discipline: 0 })).toBe(0);
    expect(calcIndividualScore({ kpi: 80, sop: 90, attendance: 95, discipline: 100 })).toBe(85.75);
  });

  it("mendukung bobot kustom dan total bobot nol", () => {
    expect(
      calcIndividualScore({ kpi: 50, sop: 0, attendance: 0, discipline: 0 }, { kpi: 1, sop: 0, attendance: 0, discipline: 0 })
    ).toBe(50);
    // Tanpa bobot → tidak ada yang bisa dinilai.
    expect(
      calcIndividualScore({ kpi: 50, sop: 50, attendance: 50, discipline: 50 }, { kpi: 0, sop: 0, attendance: 0, discipline: 0 })
    ).toBeNull();
  });

  it("komponen tanpa data dikeluarkan dari pembagi (bukan diisi 0 atau 100)", () => {
    // KPI 80 (bobot 60) + Kehadiran 95 (15) + Disiplin 100 (10) → 7225/85 = 85
    expect(calcIndividualScore({ kpi: 80, sop: null, attendance: 95, discipline: 100 })).toBe(85);
    // Hanya kehadiran 96 → skor mengikuti komponen yang ada, bukan 24.
    expect(calcIndividualScore({ kpi: null, sop: null, attendance: 96, discipline: null })).toBe(96);
  });

  it("tanpa komponen terukur → null", () => {
    expect(calcIndividualScore({ kpi: null, sop: null, attendance: null, discipline: null })).toBeNull();
  });
});

describe("cakupan pengukuran", () => {
  it("menghitung fraksi bobot yang punya skor", () => {
    expect(
      calcCoverage([
        { score: 100, weight: 30 },
        { score: null, weight: 70 },
      ])
    ).toBe(0.3);
    expect(calcCoverage([{ score: 90, weight: 100 }])).toBe(1);
    expect(calcCoverage([])).toBe(0);
  });

  it("menandai cakupan cukup untuk dinilai", () => {
    expect(hasEnoughCoverage(MIN_SCORE_COVERAGE)).toBe(true);
    expect(hasEnoughCoverage(MIN_SCORE_COVERAGE - 0.01)).toBe(false);
    expect(hasEnoughCoverage(0.3)).toBe(false);
    expect(hasEnoughCoverage(0.9)).toBe(true);
  });
});

describe("attendanceScore", () => {
  it("menghitung (hadir + terlambat) / total", () => {
    expect(attendanceScore({ hadir: 20, terlambat: 2, total: 24 })).toBe(91.67);
    expect(attendanceScore({ hadir: 24, terlambat: 0, total: 24 })).toBe(100);
  });

  it("tanpa catatan → null (bukan 100: ketiadaan data bukan kehadiran sempurna)", () => {
    expect(attendanceScore({ hadir: 0, terlambat: 0, total: 0 })).toBeNull();
  });
});

describe("disciplineScore", () => {
  it("potong 5 per keterlambatan dan 10 per alpa", () => {
    expect(disciplineScore({ terlambat: 0, alpa: 0 })).toBe(100);
    expect(disciplineScore({ terlambat: 2, alpa: 1 })).toBe(80);
  });

  it("minimum 0", () => {
    expect(disciplineScore({ terlambat: 30, alpa: 20 })).toBe(0);
  });
});

describe("helper persen/rasio/pertumbuhan", () => {
  it("safePercent null saat penyebut nol", () => {
    expect(safePercent(5, 0)).toBeNull();
    expect(safePercent(1, 3)).toBe(33.33);
    expect(safePercent(0, 10)).toBe(0);
  });

  it("safeRatio null saat penyebut nol", () => {
    expect(safeRatio(7, 0)).toBeNull();
    expect(safeRatio(7, 2)).toBe(3.5);
  });

  it("growthPercent null saat basis nol", () => {
    expect(growthPercent(100, 0)).toBeNull();
    expect(growthPercent(110, 100)).toBe(10);
    expect(growthPercent(90, 100)).toBe(-10);
    expect(growthPercent(100, 100)).toBe(0);
  });
});
