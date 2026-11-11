/**
 * Mesin skor KPI — fungsi murni tanpa dependensi server.
 * Dipakai oleh service kinerja, scorecard, review, dan tes unit.
 */

export type KpiDirection = "HIGHER_BETTER" | "LOWER_BETTER";
export type EmployeeGrade = "A" | "B" | "C" | "D";

/**
 * Minimum cakupan (fraksi bobot terukur) agar skor & grade boleh ditampilkan.
 * Di bawah ambang ini grup hanya menampilkan "Belum lengkap" — bukan angka
 * yang menyesatkan (mis. Grade A dari satu indikator di tengah data kosong).
 */
export const MIN_SCORE_COVERAGE = 0.5;

/**
 * Skor baris KPI: 0–120 (cap).
 *
 * LOWER_BETTER memakai rasio target/aktual dan di-cap 120 (lihat contoh di
 * dokumen PMS §13: komplain target 2 aktual 1 → 120). Aktual 0 berarti
 * "tidak ada hal buruk" → rasio tak terhingga → cap 120.
 * Karena itu angka 0 yang sebenarnya "tidak ada data" TIDAK boleh dibuat di
 * sini: sumbernya wajib mengembalikan null (lihat kpi-formulas.ts).
 */
export function calcScore(actual: number, target: number, direction: KpiDirection): number {
  if (target === 0) return 0;
  if (!Number.isFinite(actual)) return 0;
  const raw = direction === "HIGHER_BETTER" ? (actual / target) * 100 : actual === 0 ? 120 : (target / actual) * 100;
  return Math.max(0, Math.min(120, Math.round(raw * 100) / 100));
}

/** Skor tertimbang: Σ(skor × bobot) ÷ Σ(bobot). */
export function calcWeightedScore(lines: Array<{ score: number; weight: number }>): number {
  const totalWeight = lines.reduce((s, l) => s + l.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = lines.reduce((s, l) => s + l.score * l.weight, 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}

/**
 * Cakupan pengukuran: fraksi bobot yang punya skor terukur (0–1).
 * Baris tanpa skor dihitung sebagai "belum terukur" (bukan nol).
 */
export function calcCoverage(lines: Array<{ score: number | null; weight: number }>): number {
  const totalWeight = lines.reduce((s, l) => s + l.weight, 0);
  if (totalWeight === 0) return 0;
  const measuredWeight = lines.reduce((s, l) => (l.score === null ? s : s + l.weight), 0);
  return Math.round((measuredWeight / totalWeight) * 10000) / 10000;
}

/** True bila cakupan cukup untuk menampilkan skor & grade. */
export function hasEnoughCoverage(coverage: number, threshold: number = MIN_SCORE_COVERAGE): boolean {
  return coverage >= threshold;
}

/** Grade A ≥ 90 · B 80–89 · C 70–79 · D < 70. */
export function gradeFromScore(score: number): EmployeeGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "D";
}

export const GRADE_LABEL: Record<EmployeeGrade, string> = {
  A: "Sangat Baik",
  B: "Baik",
  C: "Cukup",
  D: "Perlu Perbaikan",
};

/** Bobot default skor individu: KPI 60 · SOP 15 · Kehadiran 15 · Kedisiplinan 10. */
export const DEFAULT_INDIVIDUAL_WEIGHTS = { kpi: 60, sop: 15, attendance: 15, discipline: 10 } as const;

export interface IndividualParts {
  kpi: number | null;
  sop: number | null;
  attendance: number | null;
  discipline: number | null;
}

/**
 * Skor individu: rata-rata tertimbang komponen yang SUDAH terukur.
 * Komponen tanpa data (null) dikeluarkan dari pembagi dan bobotnya
 * dinormalisasi ulang — bukan diisi 0 (menghukum tanpa data) atau 100
 * (menggelembungkan nilai). Tanpa satu pun komponen terukur → null.
 */
export function calcIndividualScore(
  parts: IndividualParts,
  weights: { kpi: number; sop: number; attendance: number; discipline: number } = DEFAULT_INDIVIDUAL_WEIGHTS
): number | null {
  const entries: Array<[number | null, number]> = [
    [parts.kpi, weights.kpi],
    [parts.sop, weights.sop],
    [parts.attendance, weights.attendance],
    [parts.discipline, weights.discipline],
  ];
  const present = entries.filter(
    (e): e is [number, number] => e[0] !== null && Number.isFinite(e[0]) && e[1] > 0
  );
  if (present.length === 0) return null;
  const totalWeight = present.reduce((s, e) => s + e[1], 0);
  if (totalWeight === 0) return null;
  const sum = present.reduce((s, e) => s + (e[0] as number) * e[1], 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}

/**
 * Skor kehadiran: (HADIR + TERLAMBAT) ÷ total catatan × 100.
 * Tanpa catatan → null (bukan 100): ketiadaan catatan bukan kehadiran sempurna.
 */
export function attendanceScore(counts: { hadir: number; terlambat: number; total: number }): number | null {
  if (counts.total === 0) return null;
  const present = counts.hadir + counts.terlambat;
  return Math.round((present / counts.total) * 10000) / 100;
}

/** Skor kedisiplinan: 100 − 5/terlambat − 10/alpa, minimum 0. */
export function disciplineScore(counts: { terlambat: number; alpa: number }): number {
  const raw = 100 - counts.terlambat * 5 - counts.alpa * 10;
  return Math.max(0, Math.min(100, raw));
}

/** Persen aman (n pembilang, d penyebut); null bila penyebut 0. */
export function safePercent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

/** Rasio aman; null bila penyebut 0. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

/** Δ% terhadap nilai sebelumnya; null bila basis 0. */
export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}
