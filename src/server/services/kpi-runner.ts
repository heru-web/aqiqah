import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businessUnits,
  departments,
  kpiActuals,
  kpiIndicators,
  kpiTargets,
  positions,
  salesChannels,
} from "@/db/schema";
import { runFormula, type FormulaScope } from "./kpi-formulas";
import { isPeriodEmpty } from "./kpi-activity";

/**
 * Penyusun aktual KPI otomatis (source=AUTO).
 *
 * Aturan:
 * - Indikator hanya dihitung bila punya **target** yang menutup periode tsb
 *   (target adalah definisi "yang diukur").
 * - Aktual manual/import tidak ditimpa oleh AUTO.
 * - Aktual AUTO yang berstatus VERIFIED turun ke SUBMITTED saat nilainya
 *   berubah (perlu verifikasi ulang).
 */

export type KpiFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface KpiRunResult {
  computed: number;
  updated: number;
  skippedManual: number;
  nulls: number;
  cleared: number;
  periods: Record<string, { start: string; end: string }>;
}

export function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function weekRange(asOf: string): { start: string; end: string } {
  const d = new Date(`${asOf}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // Senin = 0
  const start = new Date(d.getTime() - offset * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function monthRange(asOf: string): { start: string; end: string } {
  const [y, m] = asOf.slice(0, 7).split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function periodFor(freq: KpiFrequency, asOf: string): { start: string; end: string } {
  if (freq === "DAILY") return { start: asOf, end: asOf };
  if (freq === "WEEKLY") return weekRange(asOf);
  return monthRange(asOf);
}

async function refCode(scope: FormulaScope, id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    if (scope === "BUSINESS_UNIT") {
      const r = await db.select({ code: businessUnits.code }).from(businessUnits).where(eq(businessUnits.id, id)).limit(1);
      return r[0]?.code ?? null;
    }
    if (scope === "CHANNEL") {
      const r = await db.select({ code: salesChannels.code }).from(salesChannels).where(eq(salesChannels.id, id)).limit(1);
      return r[0]?.code ?? null;
    }
    if (scope === "DEPARTMENT") {
      const r = await db.select({ code: departments.code }).from(departments).where(eq(departments.id, id)).limit(1);
      return r[0]?.code ?? null;
    }
    if (scope === "POSITION") {
      const r = await db.select({ code: positions.code }).from(positions).where(eq(positions.id, id)).limit(1);
      return r[0]?.code ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function runKpiActuals(opts?: {
  asOf?: string;
  frequencies?: KpiFrequency[];
  branchId?: string;
}): Promise<KpiRunResult> {
  const asOf = opts?.asOf ?? jakartaToday();
  const wanted = new Set<KpiFrequency>(opts?.frequencies ?? ["DAILY", "WEEKLY", "MONTHLY"]);
  const branchId = opts?.branchId;

  const indicators = await db
    .select()
    .from(kpiIndicators)
    .where(and(eq(kpiIndicators.isActive, true), sql`${kpiIndicators.formulaKey} is not null`));

  const result: KpiRunResult = { computed: 0, updated: 0, skippedManual: 0, nulls: 0, cleared: 0, periods: {} };

  // Periode tanpa aktivitas apa pun tidak bisa dinilai → semua aktual AUTO
  // di periode itu dibersihkan (bukan diisi 0).
  const emptyCache = new Map<string, Promise<boolean>>();
  const periodIsEmpty = (period: { start: string; end: string }): Promise<boolean> => {
    const key = `${period.start}:${period.end}:${branchId ?? "*"}`;
    let cached = emptyCache.get(key);
    if (!cached) {
      cached = isPeriodEmpty(period, branchId);
      emptyCache.set(key, cached);
    }
    return cached;
  };

  for (const ind of indicators) {
    const freq = ind.frequency as KpiFrequency;
    if (!wanted.has(freq)) continue;
    const period = periodFor(freq, asOf);
    result.periods[ind.code] = period;

    // Target yang menutup periode → daftar scopeRef yang diukur.
    const targetRefs = await db
      .selectDistinct({ scopeRefId: kpiTargets.scopeRefId })
      .from(kpiTargets)
      .where(
        and(
          eq(kpiTargets.indicatorId, ind.id),
          sql`${kpiTargets.periodStart} <= ${period.start}::date`,
          sql`${kpiTargets.periodEnd} >= ${period.end}::date`
        )
      );
    if (targetRefs.length === 0) continue;

    const scope = ind.scope as FormulaScope;

    for (const { scopeRefId } of targetRefs) {
      const code = await refCode(scope, scopeRefId);
      const value = (await periodIsEmpty(period))
        ? null
        : await runFormula(ind.formulaKey as string, {
            ...period,
            branchId,
            scope,
            scopeRefId,
            refCode: code,
          });

      const existing = await db
        .select({ id: kpiActuals.id, source: kpiActuals.source, status: kpiActuals.status })
        .from(kpiActuals)
        .where(
          and(
            eq(kpiActuals.indicatorId, ind.id),
            eq(kpiActuals.periodType, freq),
            eq(kpiActuals.periodStart, period.start),
            eq(kpiActuals.periodEnd, period.end),
            scopeRefId ? eq(kpiActuals.scopeRefId, scopeRefId) : isNull(kpiActuals.scopeRefId),
            branchId ? eq(kpiActuals.branchId, branchId) : isNull(kpiActuals.branchId)
          )
        )
        .limit(1);

      if (value === null || value === undefined || !Number.isFinite(value)) {
        result.nulls++;
        // Hasil null berarti tidak ada sumber data (bukan angka 0). Aktual AUTO
        // lama harus dihapus agar dasbor tidak menampilkan angka basi.
        if (existing.length > 0 && existing[0].source === "AUTO") {
          await db.delete(kpiActuals).where(eq(kpiActuals.id, existing[0].id));
          result.cleared++;
        }
        continue;
      }

      const valueStr = String(Math.round(value * 100) / 100);

      if (existing.length === 0) {
        await db.insert(kpiActuals).values({
          indicatorId: ind.id,
          branchId: branchId ?? null,
          scopeRefId,
          periodType: freq,
          periodStart: period.start,
          periodEnd: period.end,
          actualValue: valueStr,
          source: "AUTO",
          status: "DRAFT",
          notes: `Otomatis · ${ind.formulaKey}`,
        });
        result.computed++;
        continue;
      }

      const cur = existing[0];
      if (cur.source !== "AUTO") {
        result.skippedManual++;
        continue;
      }
      await db
        .update(kpiActuals)
        .set({
          actualValue: valueStr,
          status: cur.status === "VERIFIED" ? "SUBMITTED" : cur.status,
          notes: `Otomatis · ${ind.formulaKey}`,
        })
        .where(eq(kpiActuals.id, cur.id));
      result.updated++;
    }
  }

  await sweepEmptyPeriods(branchId, result);

  return result;
}

/**
 * Bersihkan aktual AUTO pada periode yang kosong (tidak ada aktivitas).
 * Needed karena periode kosong tidak bisa dinilai — sisa aktual dari
 * perhitungan sebelumnya (atau data yang sudah dihapus) tidak boleh
 * ditampilkan sebagai angka.
 */
async function sweepEmptyPeriods(branchId: string | undefined, result: KpiRunResult): Promise<void> {
  const periods = await db
    .selectDistinct({ periodStart: kpiActuals.periodStart, periodEnd: kpiActuals.periodEnd })
    .from(kpiActuals)
    .where(and(eq(kpiActuals.source, "AUTO")));

  for (const p of periods) {
    if (!(await isPeriodEmpty({ start: p.periodStart, end: p.periodEnd }, branchId))) continue;
    const deleted = await db
      .delete(kpiActuals)
      .where(
        and(
          eq(kpiActuals.source, "AUTO"),
          eq(kpiActuals.periodStart, p.periodStart),
          eq(kpiActuals.periodEnd, p.periodEnd)
        )
      )
      .returning({ id: kpiActuals.id });
    result.cleared += deleted.length;
  }
}
