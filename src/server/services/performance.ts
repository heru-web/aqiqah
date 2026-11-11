import "server-only";
import { assertBranchAccess } from "@/lib/branch-access";
import { currentBranchWhere } from "@/lib/server/resource-access";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businessUnits,
  departments,
  marketingSpends,
  positions,
  salesChannels,
  kpiIndicators,
  kpiTargets,
  kpiActuals,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import {
  calcCoverage,
  calcScore,
  calcWeightedScore,
  gradeFromScore,
  GRADE_LABEL,
  hasEnoughCoverage,
  type EmployeeGrade,
} from "@/lib/score-engine";

/** Buang nilai undefined agar drizzle `.set()` tidak menyentuh kolom tsb. */
function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

// ── Business Units ─────────────────────────────────────────────────
export async function listBusinessUnits(includeInactive = false) {
  const cond = includeInactive ? undefined : eq(businessUnits.isActive, true);
  return db
    .select()
    .from(businessUnits)
    .where(cond)
    .orderBy(businessUnits.sortOrder, businessUnits.name);
}

export async function createBusinessUnit(
  input: { code: string; name: string; description?: string; sortOrder?: number },
  actor: AuthUser
) {
  const existing = await db
    .select({ id: businessUnits.id })
    .from(businessUnits)
    .where(eq(businessUnits.code, input.code));
  if (existing.length > 0) throw new ConflictError(`Kode "${input.code}" sudah dipakai.`);
  const [row] = await db
    .insert(businessUnits)
    .values({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: businessUnits.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "business_unit",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateBusinessUnit(
  id: string,
  input: { name?: string; description?: string; isActive?: boolean; sortOrder?: number },
  actor: AuthUser
) {
  const before = await db.select().from(businessUnits).where(eq(businessUnits.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Unit usaha tidak ditemukan.");
  await db.update(businessUnits).set(defined(input)).where(eq(businessUnits.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "business_unit",
    entityId: id,
    before: before[0],
    after: input,
  });
}

// ── Departments ────────────────────────────────────────────────────
export async function listDepartments(includeInactive = false) {
  const cond = includeInactive ? undefined : eq(departments.isActive, true);
  return db
    .select({
      dept: departments,
      buCode: businessUnits.code,
      buName: businessUnits.name,
    })
    .from(departments)
    .leftJoin(businessUnits, eq(departments.businessUnitId, businessUnits.id))
    .where(cond)
    .orderBy(departments.sortOrder, departments.name);
}

export async function createDepartment(
  input: { code: string; name: string; businessUnitId?: string; sortOrder?: number },
  actor: AuthUser
) {
  const existing = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.code, input.code));
  if (existing.length > 0) throw new ConflictError(`Kode "${input.code}" sudah dipakai.`);
  const [row] = await db
    .insert(departments)
    .values({
      code: input.code.toUpperCase(),
      name: input.name,
      businessUnitId: input.businessUnitId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: departments.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "department",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateDepartment(
  id: string,
  input: { name?: string; businessUnitId?: string; isActive?: boolean; sortOrder?: number },
  actor: AuthUser
) {
  const before = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Departemen tidak ditemukan.");
  await db.update(departments).set(defined(input)).where(eq(departments.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "department",
    entityId: id,
    before: before[0],
    after: input,
  });
}

// ── Positions ──────────────────────────────────────────────────────
export async function listPositions(includeInactive = false) {
  const cond = includeInactive ? undefined : eq(positions.isActive, true);
  return db
    .select({
      pos: positions,
      deptName: departments.name,
      deptCode: departments.code,
    })
    .from(positions)
    .innerJoin(departments, eq(positions.departmentId, departments.id))
    .where(cond)
    .orderBy(positions.sortOrder, positions.name);
}

export async function createPosition(
  input: { code: string; name: string; departmentId: string; sortOrder?: number },
  actor: AuthUser
) {
  const existing = await db.select({ id: positions.id }).from(positions).where(eq(positions.code, input.code));
  if (existing.length > 0) throw new ConflictError(`Kode "${input.code}" sudah dipakai.`);
  const [row] = await db
    .insert(positions)
    .values({
      code: input.code.toUpperCase(),
      name: input.name,
      departmentId: input.departmentId,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: positions.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "position",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updatePosition(
  id: string,
  input: { name?: string; departmentId?: string; isActive?: boolean; sortOrder?: number },
  actor: AuthUser
) {
  const before = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Jabatan tidak ditemukan.");
  await db.update(positions).set(defined(input)).where(eq(positions.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "position",
    entityId: id,
    before: before[0],
    after: input,
  });
}

// ── Sales Channels ─────────────────────────────────────────────────
export async function listSalesChannels(includeInactive = false) {
  const cond = includeInactive ? undefined : eq(salesChannels.isActive, true);
  return db
    .select()
    .from(salesChannels)
    .where(cond)
    .orderBy(salesChannels.type, salesChannels.sortOrder, salesChannels.name);
}

export async function createSalesChannel(
  input: { code: string; name: string; type: "ONLINE" | "OFFLINE"; sortOrder?: number },
  actor: AuthUser
) {
  const existing = await db
    .select({ id: salesChannels.id })
    .from(salesChannels)
    .where(eq(salesChannels.code, input.code));
  if (existing.length > 0) throw new ConflictError(`Kode "${input.code}" sudah dipakai.`);
  const [row] = await db
    .insert(salesChannels)
    .values({
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: salesChannels.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "sales_channel",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateSalesChannel(
  id: string,
  input: { name?: string; type?: "ONLINE" | "OFFLINE"; isActive?: boolean; sortOrder?: number },
  actor: AuthUser
) {
  const before = await db.select().from(salesChannels).where(eq(salesChannels.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Saluran tidak ditemukan.");
  await db.update(salesChannels).set(defined(input)).where(eq(salesChannels.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "sales_channel",
    entityId: id,
    before: before[0],
    after: input,
  });
}

// ── Marketing Spends (Iklan & Kampanye) ─────────────────────────────
export async function listMarketingSpends(branchId?: string | null, channelId?: string | null) {
  const conditions = [eq(marketingSpends.branchId, branchId ?? "")];
  if (channelId) conditions.push(eq(marketingSpends.channelId, channelId));
  return db
    .select({
      id: marketingSpends.id,
      channelId: marketingSpends.channelId,
      channelCode: salesChannels.code,
      channelName: salesChannels.name,
      periodStart: marketingSpends.periodStart,
      periodEnd: marketingSpends.periodEnd,
      amount: marketingSpends.amount,
      notes: marketingSpends.notes,
    })
    .from(marketingSpends)
    .innerJoin(salesChannels, eq(marketingSpends.channelId, salesChannels.id))
    .where(and(...conditions))
    .orderBy(desc(marketingSpends.periodStart), desc(marketingSpends.periodEnd));
}

export async function createMarketingSpend(
  input: { channelId: string; periodStart: string; periodEnd: string; amount: bigint; notes?: string | null },
  actor: AuthUser
) {
  const channel = await db
    .select({ id: salesChannels.id })
    .from(salesChannels)
    .where(eq(salesChannels.id, input.channelId))
    .limit(1);
  if (channel.length === 0) throw new NotFoundError("Saluran tidak ditemukan.");
  const [row] = await db
    .insert(marketingSpends)
    .values({
      branchId: (actor.branchId ?? "") as string,
      channelId: input.channelId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      amount: input.amount,
      notes: input.notes ?? null,
    })
    .returning({ id: marketingSpends.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "marketing_spend",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

// ── KPI Indicators ─────────────────────────────────────────────────
export async function listKpiIndicators(scope?: string) {
  const cond = scope ? eq(kpiIndicators.scope, scope as never) : undefined;
  return db
    .select()
    .from(kpiIndicators)
    .where(cond)
    .orderBy(kpiIndicators.scope, kpiIndicators.code);
}

export async function createKpiIndicator(
  input: {
    code: string;
    name: string;
    scope: string;
    unit: string;
    direction: string;
    frequency: string;
    formulaKey?: string;
    defaultScopeRefId?: string;
    description?: string;
    defaultWeight?: string;
  },
  actor: AuthUser
) {
  const existing = await db
    .select({ id: kpiIndicators.id })
    .from(kpiIndicators)
    .where(eq(kpiIndicators.code, input.code));
  if (existing.length > 0) throw new ConflictError(`Kode KPI "${input.code}" sudah dipakai.`);
  const [row] = await db
    .insert(kpiIndicators)
    .values({
      code: input.code.toUpperCase(),
      name: input.name,
      scope: input.scope as never,
      unit: input.unit as never,
      direction: input.direction as never,
      frequency: input.frequency as never,
      formulaKey: input.formulaKey ?? null,
      defaultScopeRefId: input.defaultScopeRefId ?? null,
      description: input.description ?? null,
      defaultWeight: input.defaultWeight ?? "0",
    })
    .returning({ id: kpiIndicators.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "kpi_indicator",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateKpiIndicator(
  id: string,
  input: Partial<{
    name: string;
    unit: string;
    direction: string;
    frequency: string;
    formulaKey: string;
    defaultScopeRefId: string;
    description: string;
    defaultWeight: string;
    isActive: boolean;
  }>,
  actor: AuthUser
) {
  const before = await db.select().from(kpiIndicators).where(eq(kpiIndicators.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Indikator KPI tidak ditemukan.");
  await db
    .update(kpiIndicators)
    .set(defined(input as Record<string, unknown>))
    .where(eq(kpiIndicators.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "kpi_indicator",
    entityId: id,
    before: before[0],
    after: input,
  });
}

// ── KPI Targets ────────────────────────────────────────────────────
export async function listKpiTargets(periodStart?: string, periodEnd?: string) {
  const conds = [await currentBranchWhere(kpiTargets.branchId, true)];
  if (periodStart) conds.push(gte(kpiTargets.periodStart, periodStart));
  if (periodEnd) conds.push(lte(kpiTargets.periodEnd, periodEnd));
  return db
    .select({ target: kpiTargets, indicator: kpiIndicators })
    .from(kpiTargets)
    .innerJoin(kpiIndicators, eq(kpiTargets.indicatorId, kpiIndicators.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(kpiTargets.periodStart));
}

export async function upsertKpiTarget(
  input: {
    indicatorId: string;
    branchId?: string;
    scopeRefId?: string;
    periodType?: string;
    periodStart: string;
    periodEnd: string;
    targetValue: string;
    weight: string;
    notes?: string;
  },
  actor: AuthUser
) {
  const branchId = input.branchId ?? actor.branchId;
  assertBranchAccess(actor, branchId);
  const existing = await db
    .select({ id: kpiTargets.id })
    .from(kpiTargets)
    .where(
      and(
        branchId ? eq(kpiTargets.branchId, branchId) : sql`${kpiTargets.branchId} IS NULL`,
        eq(kpiTargets.indicatorId, input.indicatorId),
        eq(kpiTargets.periodStart, input.periodStart),
        eq(kpiTargets.periodEnd, input.periodEnd),
        input.scopeRefId ? eq(kpiTargets.scopeRefId, input.scopeRefId) : sql`${kpiTargets.scopeRefId} IS NULL`
      )
    );
  if (existing.length > 0) {
    await db
      .update(kpiTargets)
      .set({ targetValue: input.targetValue, weight: input.weight, notes: input.notes ?? null })
      .where(eq(kpiTargets.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db
    .insert(kpiTargets)
    .values({
      indicatorId: input.indicatorId,
      branchId,
      scopeRefId: input.scopeRefId ?? null,
      periodType: (input.periodType ?? "MONTHLY") as never,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      targetValue: input.targetValue,
      weight: input.weight,
      notes: input.notes ?? null,
    })
    .returning({ id: kpiTargets.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "kpi_target",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

// ── KPI Actuals ────────────────────────────────────────────────────
export async function listKpiActuals(periodStart?: string, periodEnd?: string) {
  const conds = [await currentBranchWhere(kpiActuals.branchId, false)];
  if (periodStart) conds.push(gte(kpiActuals.periodStart, periodStart));
  if (periodEnd) conds.push(lte(kpiActuals.periodEnd, periodEnd));
  return db
    .select({ actual: kpiActuals, indicator: kpiIndicators })
    .from(kpiActuals)
    .innerJoin(kpiIndicators, eq(kpiActuals.indicatorId, kpiIndicators.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(kpiActuals.periodStart));
}

export async function upsertKpiActual(
  input: {
    indicatorId: string;
    branchId?: string;
    scopeRefId?: string;
    periodType?: string;
    periodStart: string;
    periodEnd: string;
    actualValue: string;
    source?: string;
    notes?: string;
  },
  actor: AuthUser
) {
  const branchId = input.branchId ?? actor.branchId;
  assertBranchAccess(actor, branchId);
  const existing = await db
    .select({ id: kpiActuals.id })
    .from(kpiActuals)
    .where(
      and(
        branchId ? eq(kpiActuals.branchId, branchId) : sql`${kpiActuals.branchId} IS NULL`,
        eq(kpiActuals.indicatorId, input.indicatorId),
        eq(kpiActuals.periodStart, input.periodStart),
        eq(kpiActuals.periodEnd, input.periodEnd),
        input.scopeRefId ? eq(kpiActuals.scopeRefId, input.scopeRefId) : sql`${kpiActuals.scopeRefId} IS NULL`
      )
    );
  if (existing.length > 0) {
    await db
      .update(kpiActuals)
      .set({
        actualValue: input.actualValue,
        source: (input.source ?? "MANUAL") as never,
        notes: input.notes ?? null,
        enteredBy: actor.id,
      })
      .where(eq(kpiActuals.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db
    .insert(kpiActuals)
    .values({
      indicatorId: input.indicatorId,
      branchId,
      scopeRefId: input.scopeRefId ?? null,
      periodType: (input.periodType ?? "MONTHLY") as never,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      actualValue: input.actualValue,
      source: (input.source ?? "MANUAL") as never,
      enteredBy: actor.id,
    })
    .returning({ id: kpiActuals.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "kpi_actual",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

// ── Score Engine (re-export dari lib murni agar bisa ditest) ───────
export { calcScore, calcWeightedScore, gradeFromScore, GRADE_LABEL };

// ── Dasbor KPI per cakupan ─────────────────────────────────────────
export type KpiScopeKey = "COMPANY" | "BUSINESS_UNIT" | "CHANNEL" | "DEPARTMENT" | "POSITION";

export interface ScopeIndicatorRow {
  indicatorId: string;
  code: string;
  name: string;
  unit: string;
  direction: string;
  frequency: string;
  formulaKey: string | null;
  targetValue: number;
  weight: number;
  actualValue: number | null;
  score: number | null;
  actualStatus: string | null;
  actualSource: string | null;
  targetNotes: string | null;
}

export interface ScopeGroup {
  refId: string | null;
  refName: string;
  refCode: string | null;
  rows: ScopeIndicatorRow[];
  /** null = belum boleh dinilai (cakupan terukur di bawah ambang). */
  score: number | null;
  /** null = belum boleh dinilai (cakupan terukur di bawah ambang). */
  grade: EmployeeGrade | null;
  measured: number;
  total: number;
  /** Cakupan pengukuran 0–1 (fraksi bobot indikator yang punya skor). */
  coverage: number;
}

const LATEST_FORMULA_KEYS = new Set(["cash_balance"]);

/** Nilai frekuensi harian/mingguan → agregat per periode bulanan. */
function aggregateValues(freq: string, unit: string, formulaKey: string | null, values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (formulaKey && LATEST_FORMULA_KEYS.has(formulaKey)) return values[values.length - 1];
  if (unit === "PERCENT" || unit === "RATIO" || unit === "DURATION" || unit === "SCORE") {
    return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
  }
  return Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100;
}

/**
 * Baris KPI per cakupan: target (periode menutup `periodStart`–`periodEnd`)
 * + aktual teragregasi + skor.
 *
 * - `refIds` kosong/null → semua grup (unit/saluran/departemen/jabatan).
 * - `includeDaily=false` menyingkirkan indikator frekuensi harian
 *   (dipakai halaman departemen/jabatan yang menampilkan ringkasan bulanan).
 */
export async function getScopeGroups(opts: {
  scope: KpiScopeKey;
  periodStart: string;
  periodEnd: string;
  refIds?: Array<string | null>;
  includeDaily?: boolean;
  branchId?: string | null;
}): Promise<ScopeGroup[]> {
  const { scope, periodStart, periodEnd } = opts;
  const targetBranch = opts.branchId === undefined ? await currentBranchWhere(kpiTargets.branchId, true) : opts.branchId ? sql`(${kpiTargets.branchId} = ${opts.branchId} or ${kpiTargets.branchId} is null)` : undefined;
  const actualBranch = opts.branchId === undefined ? await currentBranchWhere(kpiActuals.branchId) : opts.branchId ? eq(kpiActuals.branchId, opts.branchId) : undefined;

  const targetRows = await db
    .select({ target: kpiTargets, indicator: kpiIndicators })
    .from(kpiTargets)
    .innerJoin(kpiIndicators, eq(kpiTargets.indicatorId, kpiIndicators.id))
    .where(
      and(
        targetBranch,
        eq(kpiIndicators.scope, scope),
        eq(kpiIndicators.isActive, true),
        sql`${kpiTargets.periodStart} <= ${periodEnd}::date`,
        sql`${kpiTargets.periodEnd} >= ${periodStart}::date`,
        opts.includeDaily === false ? ne(kpiIndicators.frequency, "DAILY") : undefined
      )
    )
    .orderBy(kpiIndicators.code);

  const refFilter = opts.refIds && opts.refIds.length > 0 ? new Set(opts.refIds.map((r) => r ?? "\0")) : null;

  const actualRows = await db
    .select({ actual: kpiActuals, indicator: kpiIndicators })
    .from(kpiActuals)
    .innerJoin(kpiIndicators, eq(kpiActuals.indicatorId, kpiIndicators.id))
    .where(
      and(
        actualBranch,
        eq(kpiIndicators.scope, scope),
        sql`${kpiActuals.periodStart} <= ${periodEnd}::date`,
        sql`${kpiActuals.periodEnd} >= ${periodStart}::date`
      )
    )
    .orderBy(kpiActuals.periodStart);

  const actualsByKey = new Map<string, Array<{ value: number; status: string; source: string }>>();
  for (const a of actualRows) {
    if (refFilter && !refFilter.has(a.actual.scopeRefId ?? "\0")) continue;
    const key = `${a.actual.indicatorId}::${a.actual.scopeRefId ?? "\0"}`;
    const list = actualsByKey.get(key) ?? [];
    list.push({ value: Number(a.actual.actualValue), status: a.actual.status, source: a.actual.source });
    actualsByKey.set(key, list);
  }

  const groups = new Map<string, ScopeGroup>();
  const ensureGroup = (refId: string | null): ScopeGroup => {
    const key = refId ?? "\0";
    let g = groups.get(key);
    if (!g) {
      g = { refId, refName: "", refCode: null, rows: [], score: null, grade: null, measured: 0, total: 0, coverage: 0 };
      groups.set(key, g);
    }
    return g;
  };

  for (const { target, indicator } of targetRows) {
    if (refFilter && !refFilter.has(target.scopeRefId ?? "\0")) continue;
    const g = ensureGroup(target.scopeRefId);
    const key = `${indicator.id}::${target.scopeRefId ?? "\0"}`;
    const list = actualsByKey.get(key) ?? [];
    const freq = indicator.frequency;
    const values = list.map((x) => x.value);
    let actualValue: number | null;
    if (freq === "MONTHLY") {
      actualValue = values.length > 0 ? values[0] : null;
    } else if (target.periodType === "DAILY") {
      // Kuota harian: bandingkan rata-rata/hari terhadap target harian
      // (saldo/skor terakhir untuk formula non-aditif → biarkan terakhir).
      if (values.length > 1 && !(indicator.formulaKey && LATEST_FORMULA_KEYS.has(indicator.formulaKey))) {
        actualValue = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
      } else {
        actualValue = aggregateValues(freq, indicator.unit, indicator.formulaKey, values);
      }
    } else {
      actualValue = aggregateValues(freq, indicator.unit, indicator.formulaKey, values);
    }
    const targetValue = Number(target.targetValue);
    const score = actualValue !== null ? calcScore(actualValue, targetValue, indicator.direction) : null;
    const last = list[list.length - 1];
    g.rows.push({
      indicatorId: indicator.id,
      code: indicator.code,
      name: indicator.name,
      unit: indicator.unit,
      direction: indicator.direction,
      frequency: freq,
      formulaKey: indicator.formulaKey,
      targetValue,
      weight: Number(target.weight),
      actualValue,
      score,
      actualStatus: last?.status ?? null,
      actualSource: last?.source ?? null,
      targetNotes: target.notes,
    });
    g.total++;
    if (score !== null) g.measured++;
  }

  // Nama rujukan per cakupan
  const refIds = [...groups.keys()].filter((k) => k !== "\0").map((k) => k as string);
  const nameMap = new Map<string, { name: string; code: string }>();
  if (refIds.length > 0) {
    if (scope === "BUSINESS_UNIT") {
      const rows = await db.select({ id: businessUnits.id, name: businessUnits.name, code: businessUnits.code }).from(businessUnits);
      rows.forEach((r) => nameMap.set(r.id, { name: r.name, code: r.code }));
    } else if (scope === "CHANNEL") {
      const rows = await db.select({ id: salesChannels.id, name: salesChannels.name, code: salesChannels.code }).from(salesChannels);
      rows.forEach((r) => nameMap.set(r.id, { name: r.name, code: r.code }));
    } else if (scope === "DEPARTMENT") {
      const rows = await db.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments);
      rows.forEach((r) => nameMap.set(r.id, { name: r.name, code: r.code }));
    } else if (scope === "POSITION") {
      const rows = await db.select({ id: positions.id, name: positions.name, code: positions.code }).from(positions);
      rows.forEach((r) => nameMap.set(r.id, { name: r.name, code: r.code }));
    }
  }

  const out = [...groups.values()];
  for (const g of out) {
    if (g.refId) {
      const m = nameMap.get(g.refId);
      g.refName = m?.name ?? "—";
      g.refCode = m?.code ?? null;
    } else {
      g.refName = "Perusahaan";
    }
    g.coverage = calcCoverage(g.rows.map((r) => ({ score: r.score, weight: r.weight })));
    if (hasEnoughCoverage(g.coverage)) {
      g.score = calcWeightedScore(
        g.rows.filter((r) => r.score !== null).map((r) => ({ score: r.score as number, weight: r.weight }))
      );
      g.grade = gradeFromScore(g.score);
    } else {
      // Cakupan terlalu kecil → skor/grade tidak ditampilkan (tidak menipu).
      g.score = null;
      g.grade = null;
    }
  }
  out.sort((a, b) => (a.refName > b.refName ? 1 : -1));
  return out;
}

/** Ringkasan dasbor /kinerja: skor perusahaan + skor rata-rata tiap level. */
export interface KinerjaSummary {
  periodStart: string;
  periodEnd: string;
  company: ScopeGroup;
  levels: Array<{
    scope: KpiScopeKey;
    label: string;
    score: number | null;
    grade: EmployeeGrade | null;
    measured: number;
    total: number;
    coverage: number;
    groups: number;
  }>;
}

const LEVEL_LABEL: Record<KpiScopeKey, string> = {
  COMPANY: "Kinerja Perusahaan",
  BUSINESS_UNIT: "Kinerja Unit Usaha",
  CHANNEL: "Kinerja Saluran",
  DEPARTMENT: "Kinerja Departemen",
  POSITION: "Kinerja Jabatan",
};

export async function getKinerjaSummary(periodStart: string, periodEnd: string, branchId?: string | null): Promise<KinerjaSummary> {
  const scopes: KpiScopeKey[] = ["COMPANY", "BUSINESS_UNIT", "CHANNEL", "DEPARTMENT", "POSITION"];
  const results = await Promise.all(
    scopes.map((scope) =>
      getScopeGroups({
        scope,
        periodStart,
        periodEnd,
        branchId,
        includeDaily: scope === "DEPARTMENT" ? false : undefined,
      })
    )
  );

  const levels = scopes.map((scope, i) => {
    const groups = results[i];
    const measured = groups.reduce((s, g) => s + g.measured, 0);
    const total = groups.reduce((s, g) => s + g.total, 0);
    const lines = groups.flatMap((g) => g.rows.map((r) => ({ score: r.score, weight: r.weight })));
    const coverage = calcCoverage(lines);
    const score = hasEnoughCoverage(coverage)
      ? calcWeightedScore(
          lines.filter((l) => l.score !== null).map((l) => ({ score: l.score as number, weight: l.weight }))
        )
      : null;
    return {
      scope,
      label: LEVEL_LABEL[scope],
      score,
      grade: score === null ? null : gradeFromScore(score),
      measured,
      total,
      coverage,
      groups: groups.filter((g) => g.refId !== null || g.total > 0).length,
    };
  });

  const company = results[0][0] ?? {
    refId: null,
    refName: "Perusahaan",
    refCode: null,
    rows: [],
    score: null,
    grade: null,
    measured: 0,
    total: 0,
    coverage: 0,
  };

  return { periodStart, periodEnd, company, levels };
}

// ── Alur kerja aktual (DRAFT → SUBMITTED → VERIFIED) ───────────────
export async function listKpiActualRows(periodStart: string, periodEnd: string, scope?: string) {
  const conds = [
    await currentBranchWhere(kpiActuals.branchId),
    sql`${kpiActuals.periodStart} <= ${periodEnd}::date`,
    sql`${kpiActuals.periodEnd} >= ${periodStart}::date`,
    scope ? eq(kpiIndicators.scope, scope as never) : undefined,
  ];
  return db
    .select({ actual: kpiActuals, indicator: kpiIndicators })
    .from(kpiActuals)
    .innerJoin(kpiIndicators, eq(kpiActuals.indicatorId, kpiIndicators.id))
    .where(and(...conds))
    .orderBy(desc(kpiActuals.periodStart), kpiIndicators.code);
}

export async function submitKpiActual(id: string, actor: AuthUser) {
  const before = await db.select().from(kpiActuals).where(eq(kpiActuals.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Aktual KPI tidak ditemukan.");
  assertBranchAccess(actor, before[0].branchId);
  if (before[0].status !== "DRAFT") throw new ConflictError("Hanya aktual berstatus DRAFT yang bisa diajukan.");
  await db.update(kpiActuals).set({ status: "SUBMITTED" }).where(eq(kpiActuals.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "kpi_actual",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "SUBMITTED" },
  });
}

export async function verifyKpiActual(id: string, actor: AuthUser) {
  const before = await db.select().from(kpiActuals).where(eq(kpiActuals.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Aktual KPI tidak ditemukan.");
  assertBranchAccess(actor, before[0].branchId);
  if (before[0].status === "VERIFIED") throw new ConflictError("Aktual sudah terverifikasi.");
  await db
    .update(kpiActuals)
    .set({ status: "VERIFIED", verifiedBy: actor.id, verifiedAt: new Date() })
    .where(eq(kpiActuals.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "kpi_actual",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "VERIFIED" },
  });
}

export async function deleteKpiIndicator(id: string, actor: AuthUser) {
  const before = await db.select().from(kpiIndicators).where(eq(kpiIndicators.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Indikator KPI tidak ditemukan.");
  await db.delete(kpiActuals).where(eq(kpiActuals.indicatorId, id));
  await db.delete(kpiTargets).where(eq(kpiTargets.indicatorId, id));
  await db.delete(kpiIndicators).where(eq(kpiIndicators.id, id));
  await insertAudit(db, {
    actor,
    action: "DELETE",
    module: "performance",
    entityType: "kpi_indicator",
    entityId: id,
    before: before[0],
  });
}

/** Salin seluruh target satu periode ke periode lain (idempoten). */
export async function copyKpiTargets(
  from: { start: string; end: string },
  to: { start: string; end: string },
  actor: AuthUser
): Promise<number> {
  const sources = await db
    .select()
    .from(kpiTargets)
    .where(and(eq(kpiTargets.periodStart, from.start), eq(kpiTargets.periodEnd, from.end)));
  let created = 0;
  for (const t of sources) {
    const existing = await db
      .select({ id: kpiTargets.id })
      .from(kpiTargets)
      .where(
        and(
          eq(kpiTargets.indicatorId, t.indicatorId),
          eq(kpiTargets.periodStart, to.start),
          eq(kpiTargets.periodEnd, to.end),
          eq(kpiTargets.periodType, t.periodType),
          t.scopeRefId ? eq(kpiTargets.scopeRefId, t.scopeRefId) : sql`${kpiTargets.scopeRefId} IS NULL`
        )
      )
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(kpiTargets).values({
      indicatorId: t.indicatorId,
      branchId: t.branchId,
      scopeRefId: t.scopeRefId,
      periodType: t.periodType,
      periodStart: to.start,
      periodEnd: to.end,
      targetValue: t.targetValue,
      weight: t.weight,
      notes: t.notes,
    });
    created++;
  }
  if (created > 0) {
    await insertAudit(db, {
      actor,
      action: "CREATE",
      module: "performance",
      entityType: "kpi_target",
      entityId: `${from.start}→${to.start}`,
      after: { copied: created },
    });
  }
  return created;
}

/** Total bobot per grup (validasi total = 100). */
export async function weightTotals(periodStart: string, periodEnd: string) {
  const rows = await db
    .select({
      scope: kpiIndicators.scope,
      scopeRefId: kpiTargets.scopeRefId,
      total: sql<string>`coalesce(sum(${kpiTargets.weight}), 0)`,
      n: sql<number>`count(*)::int`,
    })
    .from(kpiTargets)
    .innerJoin(kpiIndicators, eq(kpiTargets.indicatorId, kpiIndicators.id))
    .where(
      and(
        sql`${kpiTargets.periodStart} <= ${periodEnd}::date`,
        sql`${kpiTargets.periodEnd} >= ${periodStart}::date`
      )
    )
    .groupBy(kpiIndicators.scope, kpiTargets.scopeRefId);
  return rows.map((r) => ({ scope: r.scope, scopeRefId: r.scopeRefId, total: Number(r.total), count: r.n }));
}

