import "server-only";
import { currentBranchWhere } from "@/lib/server/resource-access";
import { assertBranchAccess } from "@/lib/branch-access";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyScorecards,
  dailyScorecardLines,
  departments,
  kpiActuals,
  kpiIndicators,
  kpiTargets,
  weeklyReviews,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import { calcScore, calcWeightedScore, safePercent } from "@/lib/score-engine";
import { isPeriodEmpty } from "@/server/services/kpi-activity";
import {
  FORMULAS,
  companyRevenueRp,
  countComplaints,
  countLeads,
  countOrders,
  deliveryOnTimePercent,
} from "@/server/services/kpi-formulas";

// ── Scorecard Harian ───────────────────────────────────────────────
export interface ScorecardLineInput {
  indicatorId: string;
  actualValue: string;
  targetValue?: string;
  weight?: string;
  notes?: string;
}

export interface ScorecardLineView {
  indicatorId: string;
  code: string;
  name: string;
  unit: string;
  direction: string;
  targetValue: number;
  actualValue: number | null;
  weight: number;
  score: number | null;
  filled: boolean;
  source: "AUTO" | "MANUAL" | null;
  formulaKey: string | null;
  notes: string | null;
}

export interface ScorecardView {
  id: string | null;
  date: string;
  departmentId: string;
  departmentName: string;
  status: string;
  totalScore: number;
  notes: string | null;
  lines: ScorecardLineView[];
  filledCount: number;
  totalCount: number;
}

/** Daftar departemen yang punya indikator harian (target/default). */
export async function listScorecardDepartments() {
  const rows = await db
    .selectDistinct({ id: departments.id, code: departments.code, name: departments.name })
    .from(departments)
    .innerJoin(kpiIndicators, eq(kpiIndicators.defaultScopeRefId, departments.id))
    .where(and(eq(kpiIndicators.frequency, "DAILY"), eq(kpiIndicators.scope, "DEPARTMENT"), eq(kpiIndicators.isActive, true)))
    .orderBy(departments.code);
  if (rows.length > 0) return rows;
  return db.select({ id: departments.id, code: departments.code, name: departments.name }).from(departments).orderBy(departments.code);
}

/**
 * Ambil (atau siapkan draft) scorecard harian sebuah departemen.
 * Baris berformula otomatis terisi dari aktual AUTO hari itu.
 */
export async function getDailyScorecard(branchId: string, date: string, departmentId: string): Promise<ScorecardView> {
  const dept = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
  if (dept.length === 0) throw new NotFoundError("Departemen tidak ditemukan.");

  const indicators = await db
    .select({ indicator: kpiIndicators, target: kpiTargets })
    .from(kpiIndicators)
    .leftJoin(
      kpiTargets,
      and(
        eq(kpiTargets.indicatorId, kpiIndicators.id),
        eq(kpiTargets.scopeRefId, departmentId),
        sql`${kpiTargets.periodStart} <= ${date}::date`,
        sql`${kpiTargets.periodEnd} >= ${date}::date`
      )
    )
    .where(
      and(
        eq(kpiIndicators.scope, "DEPARTMENT"),
        eq(kpiIndicators.frequency, "DAILY"),
        eq(kpiIndicators.isActive, true),
        sql`(${kpiIndicators.defaultScopeRefId} = ${departmentId} or ${kpiTargets.id} is not null)`
      )
    )
    .orderBy(kpiIndicators.code);

  const card = await db
    .select()
    .from(dailyScorecards)
    .where(
      and(
        eq(dailyScorecards.branchId, branchId),
        eq(dailyScorecards.date, date),
        eq(dailyScorecards.departmentId, departmentId)
      )
    )
    .limit(1);

  const lines = card.length > 0
    ? await db.select().from(dailyScorecardLines).where(eq(dailyScorecardLines.scorecardId, card[0].id))
    : [];
  const lineByInd = new Map(lines.map((l) => [l.indicatorId, l]));

  const actuals = await db
    .select()
    .from(kpiActuals)
    .where(
      and(
        eq(kpiActuals.scopeRefId, departmentId),
        eq(kpiActuals.periodType, "DAILY"),
        eq(kpiActuals.periodStart, date),
        eq(kpiActuals.periodEnd, date)
      )
    );
  const actualByInd = new Map(actuals.map((a) => [a.indicatorId, a]));

  const viewLines: ScorecardLineView[] = indicators.map(({ indicator, target }) => {
    const stored = lineByInd.get(indicator.id);
    const auto = actualByInd.get(indicator.id);
    const targetValue = stored ? Number(stored.targetValue) : Number(target?.targetValue ?? 0);
    const actualRaw = stored ? stored.actualValue : (auto?.actualValue ?? null);
    const actualValue = actualRaw !== null ? Number(actualRaw) : null;
    const weight = stored ? Number(stored.weight) : Number(target?.weight ?? indicator.defaultWeight);
    return {
      indicatorId: indicator.id,
      code: indicator.code,
      name: indicator.name,
      unit: indicator.unit,
      direction: indicator.direction,
      targetValue,
      actualValue,
      weight,
      score: actualValue !== null && targetValue > 0 ? calcScore(actualValue, targetValue, indicator.direction) : null,
      filled: actualValue !== null,
      source: stored ? "MANUAL" : auto ? "AUTO" : null,
      formulaKey: indicator.formulaKey,
      notes: stored?.notes ?? null,
    };
  });

  const filled = viewLines.filter((l) => l.filled).length;
  const total = calcWeightedScore(
    viewLines.filter((l) => l.score !== null).map((l) => ({ score: l.score as number, weight: l.weight }))
  );

  return {
    id: card[0]?.id ?? null,
    date,
    departmentId,
    departmentName: dept[0].name,
    status: card[0]?.status ?? "DRAFT",
    totalScore: card.length > 0 ? Number(card[0].totalScore) : total,
    notes: card[0]?.notes ?? null,
    lines: viewLines,
    filledCount: filled,
    totalCount: viewLines.length,
  };
}

/** Simpan scorecard (upsert + ganti semua baris; idempoten per dept+tanggal). */
export async function saveDailyScorecard(
  input: {
    branchId: string;
    date: string;
    departmentId: string;
    lines: ScorecardLineInput[];
    notes?: string;
  },
  actor: AuthUser
): Promise<string> {
  const targets = await db
    .select()
    .from(kpiTargets)
    .where(
      and(
        eq(kpiTargets.scopeRefId, input.departmentId),
        sql`${kpiTargets.periodStart} <= ${input.date}::date`,
        sql`${kpiTargets.periodEnd} >= ${input.date}::date`
      )
    );
  const targetByInd = new Map(targets.map((t) => [t.indicatorId, t]));

  const inds = await db.select().from(kpiIndicators).where(eq(kpiIndicators.frequency, "DAILY"));
  const weightByInd = new Map(inds.map((i) => [i.id, i.defaultWeight]));

  let total = 0;
  const rows = input.lines.map((l) => {
    const t = targetByInd.get(l.indicatorId);
    const targetValue = l.targetValue ?? String(t?.targetValue ?? 0);
    const weight = l.weight ?? String(t?.weight ?? weightByInd.get(l.indicatorId) ?? 0);
    const actual = Number(l.actualValue);
    const ind = inds.find((i) => i.id === l.indicatorId);
    const score = ind && Number(targetValue) > 0 ? calcScore(actual, Number(targetValue), ind.direction) : 0;
    total += score * Number(weight);
    return {
      indicatorId: l.indicatorId,
      targetValue,
      actualValue: String(actual),
      score: String(score),
      weight,
      notes: l.notes ?? null,
    };
  });
  const weightSum = rows.reduce((s, r) => s + Number(r.weight), 0);
  const totalScore = weightSum > 0 ? Math.round((total / weightSum) * 100) / 100 : 0;

  const existing = await db
    .select({ id: dailyScorecards.id, status: dailyScorecards.status })
    .from(dailyScorecards)
    .where(
      and(
        eq(dailyScorecards.branchId, input.branchId),
        eq(dailyScorecards.date, input.date),
        eq(dailyScorecards.departmentId, input.departmentId)
      )
    )
    .limit(1);

  let cardId: string;
  if (existing.length > 0) {
    cardId = existing[0].id;
    await db
      .update(dailyScorecards)
      .set({
        totalScore: String(totalScore),
        notes: input.notes ?? null,
        status: existing[0].status === "VERIFIED" ? "SUBMITTED" : (existing[0].status as never),
      })
      .where(eq(dailyScorecards.id, cardId));
    await db.delete(dailyScorecardLines).where(eq(dailyScorecardLines.scorecardId, cardId));
  } else {
    const [row] = await db
      .insert(dailyScorecards)
      .values({
        branchId: input.branchId,
        date: input.date,
        departmentId: input.departmentId,
        totalScore: String(totalScore),
        notes: input.notes ?? null,
      })
      .returning({ id: dailyScorecards.id });
    cardId = row.id;
  }

  if (rows.length > 0) {
    await db.insert(dailyScorecardLines).values(rows.map((r) => ({ ...r, scorecardId: cardId })));
  }

  await insertAudit(db, {
    actor,
    action: existing.length > 0 ? "UPDATE" : "CREATE",
    module: "performance",
    entityType: "daily_scorecard",
    entityId: cardId,
    after: { date: input.date, departmentId: input.departmentId, totalScore, lines: rows.length },
  });
  return cardId;
}

async function ensureCardStatus(id: string, from: string[]) {
  const card = await db.select().from(dailyScorecards).where(eq(dailyScorecards.id, id)).limit(1);
  if (card.length === 0) throw new NotFoundError("Scorecard tidak ditemukan.");
  if (!from.includes(card[0].status)) {
    throw new ConflictError(`Status scorecard "${card[0].status}" tidak memungkinkan aksi ini.`);
  }
  return card[0];
}

export async function submitDailyScorecard(id: string, actor: AuthUser) {
  const before = await ensureCardStatus(id, ["DRAFT"]);
  assertBranchAccess(actor, before.branchId);
  await db
    .update(dailyScorecards)
    .set({ status: "SUBMITTED", submittedBy: actor.id, submittedAt: new Date() })
    .where(eq(dailyScorecards.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "daily_scorecard",
    entityId: id,
    before: { status: before.status },
    after: { status: "SUBMITTED" },
  });
}

export async function verifyDailyScorecard(id: string, actor: AuthUser) {
  const before = await ensureCardStatus(id, ["SUBMITTED", "DRAFT"]);
  assertBranchAccess(actor, before.branchId);
  await db.update(dailyScorecards).set({ status: "VERIFIED" }).where(eq(dailyScorecards.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "daily_scorecard",
    entityId: id,
    before: { status: before.status },
    after: { status: "VERIFIED" },
  });
}

export async function listDailyScorecards(monthStart: string, monthEnd: string, departmentId?: string) {
  return db
    .select({
      card: dailyScorecards,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(dailyScorecards)
    .innerJoin(departments, eq(dailyScorecards.departmentId, departments.id))
    .where(
      and(
        await currentBranchWhere(dailyScorecards.branchId),
        gte(dailyScorecards.date, monthStart),
        lte(dailyScorecards.date, monthEnd),
        departmentId ? eq(dailyScorecards.departmentId, departmentId) : undefined
      )
    )
    .orderBy(desc(dailyScorecards.date), departments.code);
}

// ── Review Mingguan (9 metrik) ─────────────────────────────────────
export interface WeeklyMetric {
  key: string;
  label: string;
  unit: "CURRENCY" | "COUNT" | "PERCENT" | "BALANCE" | "MODULE";
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
}

const WEEKLY_METRIC_DEFS: Array<Omit<WeeklyMetric, "current" | "previous" | "deltaPct">> = [
  { key: "revenue", label: "Pendapatan", unit: "CURRENCY" },
  { key: "leads", label: "Lead", unit: "COUNT" },
  { key: "conversion", label: "Konversi", unit: "PERCENT" },
  { key: "marketplace", label: "Marketplace (pesanan)", unit: "COUNT" },
  { key: "resto", label: "Resto (omzet)", unit: "CURRENCY" },
  { key: "production", label: "Produksi", unit: "MODULE" },
  { key: "delivery", label: "Pengiriman tepat waktu", unit: "PERCENT" },
  { key: "cash", label: "Kas & Bank", unit: "BALANCE" },
  { key: "complaints", label: "Komplain pelanggan", unit: "COUNT" },
];

async function computeMetrics(period: { start: string; end: string }): Promise<Record<string, number | null>> {
  // Periode tanpa aktivitas apa pun → metrik berstatus "Belum ada data",
  // bukan angka 0 (kas tetap ditampilkan karena saldo adalah fakta kumulatif).
  const empty = await isPeriodEmpty(period);
  const [revenue, leads, orders, marketplace, resto, delivery, cash, complaints] = await Promise.all([
    companyRevenueRp(period),
    countLeads(period),
    countOrders(period),
    FORMULAS.channel_orders({ ...period, scope: "CHANNEL", refCode: "MARKETPLACE" }),
    FORMULAS.channel_revenue({ ...period, scope: "CHANNEL", refCode: "RESTO" }),
    deliveryOnTimePercent(period),
    FORMULAS.cash_balance({ ...period, scope: "COMPANY" }),
    countComplaints(period),
  ]);
  return {
    revenue: empty ? null : revenue,
    leads: empty ? null : leads,
    conversion: empty || orders === null || leads === null ? null : safePercent(orders, leads),
    marketplace: empty ? null : marketplace,
    resto: empty ? null : resto,
    production: null, // modul Produksi belum ada — tampil "Menunggu modul"
    delivery: empty ? null : delivery,
    cash,
    complaints: empty ? null : complaints,
  };
}

export function currentWeekRange(now = new Date()): { start: string; end: string } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const d = new Date(`${iso}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const start = new Date(d.getTime() - offset * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function previousWeekOf(weekStart: string): { start: string; end: string } {
  const s = new Date(`${weekStart}T00:00:00Z`);
  const ps = new Date(s.getTime() - 7 * 86400000);
  const pe = new Date(s.getTime() - 1 * 86400000);
  return { start: ps.toISOString().slice(0, 10), end: pe.toISOString().slice(0, 10) };
}

/** Hitung 9 metrik minggu ini vs minggu lalu. */
export async function computeWeeklySnapshot(weekStart: string): Promise<{
  weekStart: string;
  weekEnd: string;
  prevStart: string;
  prevEnd: string;
  metrics: WeeklyMetric[];
  generatedAt: string;
}> {
  const start = weekStart;
  const d = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const prev = previousWeekOf(weekStart);

  const [cur, prevVals] = await Promise.all([computeMetrics({ start, end }), computeMetrics(prev)]);

  const metrics: WeeklyMetric[] = WEEKLY_METRIC_DEFS.map((m) => {
    const current = cur[m.key] ?? null;
    const previous = prevVals[m.key] ?? null;
    let deltaPct: number | null = null;
    if (current !== null && previous !== null && previous !== 0) {
      deltaPct = Math.round(((current - previous) / previous) * 10000) / 100;
    }
    return { ...m, current, previous, deltaPct };
  });

  return {
    weekStart: start,
    weekEnd: end,
    prevStart: prev.start,
    prevEnd: prev.end,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}

export async function getWeeklyReview(branchId: string, weekStart: string) {
  const stored = await db.select().from(weeklyReviews).where(eq(weeklyReviews.weekStart, weekStart)).limit(1);
  const snapshot = await computeWeeklySnapshot(weekStart);
  if (stored.length === 0) {
    return { review: null, ...snapshot };
  }
  return { review: stored[0], ...snapshot };
}

export async function listWeeklyReviews(limit = 12) {
  return db.select().from(weeklyReviews).where(await currentBranchWhere(weeklyReviews.branchId)).orderBy(desc(weeklyReviews.weekStart)).limit(limit);
}

export async function saveWeeklyReview(
  input: { branchId: string; weekStart: string; decisions?: unknown; summary?: unknown },
  actor: AuthUser
): Promise<string> {
  const snapshot = await computeWeeklySnapshot(input.weekStart);
  const end = snapshot.weekEnd;
  const existing = await db
    .select({ id: weeklyReviews.id, status: weeklyReviews.status })
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.branchId, input.branchId), eq(weeklyReviews.weekStart, input.weekStart)))
    .limit(1);

  const summary = input.summary ?? snapshot;
  if (existing.length > 0) {
    if (existing[0].status === "FINAL") throw new ConflictError("Review mingguan sudah di-final.");
    await db
      .update(weeklyReviews)
      .set({ summary, decisions: input.decisions ?? undefined })
      .where(eq(weeklyReviews.id, existing[0].id));
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: "performance",
      entityType: "weekly_review",
      entityId: existing[0].id,
      after: { weekStart: input.weekStart },
    });
    return existing[0].id;
  }
  const [row] = await db
    .insert(weeklyReviews)
    .values({
      branchId: input.branchId,
      weekStart: input.weekStart,
      weekEnd: end,
      summary,
      decisions: input.decisions ?? [],
      createdBy: actor.id,
    })
    .returning({ id: weeklyReviews.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "weekly_review",
    entityId: row.id,
    after: { weekStart: input.weekStart },
  });
  return row.id;
}

export async function finalizeWeeklyReview(id: string, actor: AuthUser) {
  const before = await db.select().from(weeklyReviews).where(eq(weeklyReviews.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Review mingguan tidak ditemukan.");
  if (before[0].status === "FINAL") throw new ConflictError("Review sudah di-final.");
  await db
    .update(weeklyReviews)
    .set({ status: "FINAL", finalizedAt: new Date() })
    .where(eq(weeklyReviews.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "weekly_review",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "FINAL" },
  });
}
