import "server-only";
import { currentBranchWhere } from "@/lib/server/resource-access";
import { assertBranchAccess } from "@/lib/branch-access";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords,
  coachingNotes,
  correctiveActions,
  departments,
  employees,
  employeePerformances,
  monthlyReviews,
  monthlyReviewLines,
  positions,
  rewards,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import {
  calcIndividualScore,
  attendanceScore,
  disciplineScore,
  gradeFromScore,
} from "@/lib/score-engine";
import { getKinerjaSummary, getScopeGroups, type ScopeGroup } from "@/server/services/performance";
import { attendanceCountsForEmployees, sopScoresByEmployee } from "@/server/services/hr";
import { firstRow } from "@/lib/server/sql-helpers";

// ── Review Bulanan ─────────────────────────────────────────────────
export async function listMonthlyReviews(limit = 12) {
  return db.select().from(monthlyReviews).where(await currentBranchWhere(monthlyReviews.branchId)).orderBy(desc(monthlyReviews.periodStart)).limit(limit);
}

export async function getMonthlyReview(id: string) {
  const rows = await db.select().from(monthlyReviews).where(eq(monthlyReviews.id, id)).limit(1);
  if (rows.length === 0) throw new NotFoundError("Review bulanan tidak ditemukan.");
  const lines = await db
    .select()
    .from(monthlyReviewLines)
    .where(eq(monthlyReviewLines.reviewId, id))
    .orderBy(monthlyReviewLines.section, monthlyReviewLines.refId);
  return { review: rows[0], lines };
}

export async function getMonthlyReviewByPeriod(branchId: string, periodStart: string) {
  const rows = await db
    .select()
    .from(monthlyReviews)
    .where(and(eq(monthlyReviews.branchId, branchId), eq(monthlyReviews.periodStart, periodStart)))
    .limit(1);
  if (rows.length === 0) return null;
  return getMonthlyReview(rows[0].id);
}

/**
 * Buat/segarkan draft review bulanan: ringkas skor 5 level + baris indikator
 * per seksi (otomatis dari target/aktual) + baris individu.
 */
export async function generateMonthlyReview(
  input: { branchId: string; periodStart: string; periodEnd: string },
  actor: AuthUser
): Promise<string> {
  const existing = await db
    .select()
    .from(monthlyReviews)
    .where(and(eq(monthlyReviews.branchId, input.branchId), eq(monthlyReviews.periodStart, input.periodStart)))
    .limit(1);
  if (existing.length > 0 && existing[0].status === "APPROVED") {
    throw new ConflictError("Review yang sudah disetujui tidak bisa di-generate ulang.");
  }

  const summary = await getKinerjaSummary(input.periodStart, input.periodEnd, input.branchId);

  let reviewId: string;
  if (existing.length > 0) {
    reviewId = existing[0].id;
    await db
      .update(monthlyReviews)
      .set({ periodEnd: input.periodEnd, companyScore: String(summary.company.score) })
      .where(eq(monthlyReviews.id, reviewId));
    await db.delete(monthlyReviewLines).where(eq(monthlyReviewLines.reviewId, reviewId));
  } else {
    const [row] = await db
      .insert(monthlyReviews)
      .values({
        branchId: input.branchId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        companyScore: String(summary.company.score),
      })
      .returning({ id: monthlyReviews.id });
    reviewId = row.id;
  }

  type LineVal = {
    section: "COMPANY" | "BUSINESS_UNIT" | "CHANNEL" | "DEPARTMENT" | "INDIVIDUAL";
    refId: string | null;
    indicatorId: string | null;
    targetValue: number;
    actualValue: number;
    score: number;
    weight: number;
    notes: string | null;
  };
  const lines: LineVal[] = [];

  const pushGroup = (section: LineVal["section"], g: ScopeGroup) => {
    for (const r of g.rows) {
      lines.push({
        section,
        refId: g.refId,
        indicatorId: r.indicatorId,
        targetValue: r.targetValue,
        actualValue: r.actualValue ?? 0,
        score: r.score ?? 0,
        weight: r.weight,
        notes: r.actualValue === null ? "Menunggu data" : `${g.refName} · ${r.code}`,
      });
    }
  };

  if (summary.company.rows.length > 0) pushGroup("COMPANY", summary.company);
  const [units, channels, departments] = await Promise.all([
    getScopeGroups({ branchId: input.branchId, scope: "BUSINESS_UNIT", periodStart: input.periodStart, periodEnd: input.periodEnd }),
    getScopeGroups({ branchId: input.branchId, scope: "CHANNEL", periodStart: input.periodStart, periodEnd: input.periodEnd }),
    getScopeGroups({ branchId: input.branchId, scope: "DEPARTMENT", periodStart: input.periodStart, periodEnd: input.periodEnd, includeDaily: false }),
  ]);
  units.forEach((g) => pushGroup("BUSINESS_UNIT", g));
  channels.forEach((g) => pushGroup("CHANNEL", g));
  departments.forEach((g) => pushGroup("DEPARTMENT", g));

  const indivs = await computeEmployeePerformances(input.periodStart, input.periodEnd, actor);
  for (const p of indivs) {
    if (p.finalScore === null) continue;
    lines.push({
      section: "INDIVIDUAL",
      refId: p.employeeId,
      indicatorId: null,
      targetValue: 100,
      actualValue: p.finalScore,
      score: p.finalScore,
      weight: 100,
      notes: `${p.name} · Grade ${p.grade ?? "—"}`,
    });
  }

  if (lines.length > 0) {
    await db.insert(monthlyReviewLines).values(
      lines.map((l) => ({
        reviewId,
        section: l.section,
        refId: l.refId,
        indicatorId: l.indicatorId,
        targetValue: String(l.targetValue),
        actualValue: String(l.actualValue),
        score: String(l.score),
        weight: String(l.weight),
        notes: l.notes,
      }))
    );
  }

  await insertAudit(db, {
    actor,
    action: existing.length > 0 ? "UPDATE" : "CREATE",
    module: "performance",
    entityType: "monthly_review",
    entityId: reviewId,
    after: { periodStart: input.periodStart, companyScore: summary.company.score, lines: lines.length },
  });
  return reviewId;
}

export async function submitMonthlyReview(id: string, actor: AuthUser) {
  const before = await db.select().from(monthlyReviews).where(eq(monthlyReviews.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Review bulanan tidak ditemukan.");
  assertBranchAccess(actor, before[0].branchId);
  if (before[0].status !== "DRAFT") throw new ConflictError("Hanya review DRAFT yang bisa diajukan.");
  await db.update(monthlyReviews).set({ status: "REVIEW" }).where(eq(monthlyReviews.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "monthly_review",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "REVIEW" },
  });
}

export async function approveMonthlyReview(id: string, actor: AuthUser) {
  const before = await db.select().from(monthlyReviews).where(eq(monthlyReviews.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Review bulanan tidak ditemukan.");
  assertBranchAccess(actor, before[0].branchId);
  if (before[0].status !== "REVIEW") throw new ConflictError("Hanya review berstatus REVIEW yang bisa disetujui.");
  await db
    .update(monthlyReviews)
    .set({ status: "APPROVED", approvedBy: actor.id, approvedAt: new Date() })
    .where(eq(monthlyReviews.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "monthly_review",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "APPROVED" },
  });
}

/** Seksi pendukung review bulanan (SOP, absensi, coaching, reward, PIP). */
export async function getMonthlySupportingData(periodStart: string, periodEnd: string) {
  const [sopAgg, attAgg, coaching, coachingCount, rewardAgg, corrective] = await Promise.all([
    firstRow<{ avg: number | null; n: number }>(
      sql`select avg(score)::float8 as avg, count(*)::int as n from sop_checks
          where period_start <= ${periodEnd}::date and period_end >= ${periodStart}::date`
    ),
    db
      .select({ status: attendanceRecords.status, n: sql<number>`count(*)::int` })
      .from(attendanceRecords)
      .where(and(gte(attendanceRecords.date, periodStart), lte(attendanceRecords.date, periodEnd)))
      .groupBy(attendanceRecords.status),
    db
      .select({
        id: coachingNotes.id,
        employeeId: coachingNotes.employeeId,
        employeeName: employees.name,
        date: coachingNotes.date,
        type: coachingNotes.type,
        topic: coachingNotes.topic,
        notes: coachingNotes.notes,
        nextAction: coachingNotes.nextAction,
        followUpAt: coachingNotes.followUpAt,
      })
      .from(coachingNotes)
      .leftJoin(employees, eq(coachingNotes.employeeId, employees.id))
      .where(and(gte(coachingNotes.date, periodStart), lte(coachingNotes.date, periodEnd)))
      .orderBy(coachingNotes.date),
    firstRow<{ n: number }>(
      sql`select count(*)::int as n from coaching_notes
          where date between ${periodStart}::date and ${periodEnd}::date`
    ),
    firstRow<{ total: number | null; n: number }>(
      sql`select coalesce(sum(amount), 0)::float8 / 100.0 as total, count(*)::int as n from rewards
          where period_start <= ${periodEnd}::date and period_end >= ${periodStart}::date`
    ),
    db
      .select({
        id: correctiveActions.id,
        employeeId: correctiveActions.employeeId,
        employeeName: employees.name,
        issue: correctiveActions.issue,
        actionPlan: correctiveActions.actionPlan,
        dueDate: correctiveActions.dueDate,
        status: correctiveActions.status,
      })
      .from(correctiveActions)
      .leftJoin(employees, eq(correctiveActions.employeeId, employees.id))
      .where(and(gte(correctiveActions.periodStart, periodStart), lte(correctiveActions.periodEnd, periodEnd)))
      .orderBy(correctiveActions.dueDate),
  ]);

  const attMap: Record<string, number> = {};
  for (const a of attAgg) attMap[a.status] = a.n;
  const total = Object.values(attMap).reduce((s, v) => s + v, 0);

  return {
    sop: { average: sopAgg?.avg !== null && sopAgg?.avg !== undefined ? Math.round(Number(sopAgg.avg) * 100) / 100 : null, checks: sopAgg?.n ?? 0 },
    attendance: {
      hadir: attMap.HADIR ?? 0,
      terlambat: attMap.TERLAMBAT ?? 0,
      alpa: attMap.ALPA ?? 0,
      izin: attMap.IZIN ?? 0,
      sakit: attMap.SAKIT ?? 0,
      total,
      // Tanpa catatan absensi → null (bukan 100): tidak ada data bukan kehadiran sempurna.
      attendanceScore:
        total > 0
          ? attendanceScore({
              hadir: attMap.HADIR ?? 0,
              terlambat: attMap.TERLAMBAT ?? 0,
              total,
            })
          : null,
      disciplineScore: disciplineScore({ terlambat: attMap.TERLAMBAT ?? 0, alpa: attMap.ALPA ?? 0 }),
    },
    coaching,
    coachingCount: coachingCount?.n ?? 0,
    rewards: { totalAmount: Math.round(Number(rewardAgg?.total ?? 0)), count: rewardAgg?.n ?? 0 },
    corrective,
  };
}

// ── Skor Individu ──────────────────────────────────────────────────
export interface EmployeePerformanceRow {
  id: string;
  employeeId: string;
  name: string;
  employeeNumber: string;
  positionName: string | null;
  departmentName: string | null;
  /** null = komponen tidak terukur (bukan 0). */
  kpiScore: number | null;
  sopScore: number | null;
  attendanceScore: number | null;
  disciplineScore: number | null;
  finalScore: number | null;
  grade: string | null;
  notes: string | null;
}

/** Penanda komponen yang tidak terukur (disimpan di kolom `notes`). */
const MISSING_PREFIX = "tanpa data: ";

function missingNote(parts: string[]): string | null {
  return parts.length > 0 ? `${MISSING_PREFIX}${parts.join(", ")}` : null;
}

function parseMissing(notes: string | null): string[] {
  if (!notes || !notes.startsWith(MISSING_PREFIX)) return [];
  return notes.slice(MISSING_PREFIX.length).split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * Hitung & simpan skor seluruh karyawan untuk periode.
 * KPI = skor jabatan (level 5), SOP = rata-rata cek, kehadiran & disiplin
 * dari rekap absensi. Idempoten per (employeeId, periodStart).
 */
export async function computeEmployeePerformances(
  periodStart: string,
  periodEnd: string,
  actor: AuthUser
): Promise<EmployeePerformanceRow[]> {
  const staff = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      name: employees.name,
      positionId: employees.positionId,
      positionName: positions.name,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(isNull(employees.deletedAt), sql`${employees.status} <> 'RESIGN'`, actor.branchId ? eq(employees.branchId, actor.branchId) : undefined))
    .orderBy(employees.employeeNumber);

  const positionGroups = await getScopeGroups({
    branchId: actor.branchId,
    scope: "POSITION",
    periodStart,
    periodEnd,
  });
  const kpiByPosition = new Map(positionGroups.map((g) => [g.refId, g.score]));
  const [sopMap, attMap] = await Promise.all([
    sopScoresByEmployee(periodStart, periodEnd),
    attendanceCountsForEmployees(periodStart, periodEnd),
  ]);

  const out: EmployeePerformanceRow[] = [];
  for (const s of staff) {
    // Komponen tanpa data = null (tidak diisi 0/100), dan bobotnya dikeluarkan
    // dari pembagi skor individu — lihat calcIndividualScore.
    const kpi = s.positionId ? kpiByPosition.get(s.positionId) ?? null : null;
    const sop = sopMap.get(s.id)?.score ?? null;
    const counts = attMap.get(s.id) ?? {};
    const hadir = counts.HADIR ?? 0;
    const terlambat = counts.TERLAMBAT ?? 0;
    const alpa = counts.ALPA ?? 0;
    const total = hadir + terlambat + alpa + (counts.IZIN ?? 0) + (counts.SAKIT ?? 0);
    const att = attendanceScore({ hadir, terlambat, total });
    const disc = total > 0 ? disciplineScore({ terlambat, alpa }) : null;
    const final = calcIndividualScore({ kpi, sop, attendance: att, discipline: disc });
    const grade = final === null ? null : gradeFromScore(final);
    const missing = [
      kpi === null ? "kpi" : null,
      sop === null ? "sop" : null,
      att === null ? "kehadiran" : null,
      disc === null ? "disiplin" : null,
    ].filter((x): x is string => x !== null);
    const notes = missingNote(missing);

    const existing = await db
      .select({ id: employeePerformances.id })
      .from(employeePerformances)
      .where(and(eq(employeePerformances.employeeId, s.id), eq(employeePerformances.periodStart, periodStart)))
      .limit(1);
    if (final === null) {
      // Tidak ada satu pun komponen terukur → tidak ada skor yang boleh tampil.
      if (existing.length > 0) {
        await db.delete(employeePerformances).where(eq(employeePerformances.id, existing[0].id));
      }
      continue;
    }

    const values = {
      // Kolom komponen bersifat notNull di DB; komponen yang tidak terukur
      // ditandai lewat `notes` dan ditampilkan "—" di UI (bukan angka 0).
      kpiScore: String(kpi ?? 0),
      sopScore: String(sop ?? 0),
      attendanceScore: String(att ?? 0),
      disciplineScore: String(disc ?? 0),
      finalScore: String(final),
      grade: grade as never,
      notes,
      periodEnd,
    };
    if (existing.length > 0) {
      await db.update(employeePerformances).set(values).where(eq(employeePerformances.id, existing[0].id));
    } else {
      await db.insert(employeePerformances).values({ employeeId: s.id, periodStart, ...values });
    }

    out.push({
      id: existing[0]?.id ?? "",
      employeeId: s.id,
      name: s.name,
      employeeNumber: s.employeeNumber,
      positionName: s.positionName,
      departmentName: s.departmentName,
      kpiScore: kpi,
      sopScore: sop,
      attendanceScore: att,
      disciplineScore: disc,
      finalScore: final,
      grade,
      notes,
    });
  }

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "employee_performance",
    entityId: `${periodStart}`,
    metadata: { employees: out.length },
  });
  return out;
}

export async function listEmployeePerformances(periodStart: string) {
  const rows = await db
    .select({
      p: employeePerformances,
      name: employees.name,
      employeeNumber: employees.employeeNumber,
      positionName: sql<string | null>`(select name from positions where id = ${employees.positionId})`,
      departmentName: sql<string | null>`(select name from departments where id = ${employees.departmentId})`,
    })
    .from(employeePerformances)
    .innerJoin(employees, eq(employeePerformances.employeeId, employees.id))
    .where(eq(employeePerformances.periodStart, periodStart))
    .orderBy(desc(employeePerformances.finalScore));

  return rows.map((r) => {
    const missing = parseMissing(r.p.notes);
    return {
      id: r.p.id,
      employeeId: r.p.employeeId,
      name: r.name,
      employeeNumber: r.employeeNumber,
      positionName: r.positionName,
      departmentName: r.departmentName,
      kpiScore: missing.includes("kpi") ? null : Number(r.p.kpiScore),
      sopScore: missing.includes("sop") ? null : Number(r.p.sopScore),
      attendanceScore: missing.includes("kehadiran") ? null : Number(r.p.attendanceScore),
      disciplineScore: missing.includes("disiplin") ? null : Number(r.p.disciplineScore),
      finalScore: Number(r.p.finalScore),
      grade: r.p.grade ?? null,
      notes: r.p.notes,
    };
  }) satisfies EmployeePerformanceRow[];
}

// ── Coaching · Reward · Corrective ─────────────────────────────────
export async function listCoaching(employeeId?: string) {
  return db
    .select({
      id: coachingNotes.id,
      employeeId: coachingNotes.employeeId,
      employeeName: employees.name,
      date: coachingNotes.date,
      type: coachingNotes.type,
      topic: coachingNotes.topic,
      notes: coachingNotes.notes,
      nextAction: coachingNotes.nextAction,
      followUpAt: coachingNotes.followUpAt,
    })
    .from(coachingNotes)
    .leftJoin(employees, eq(coachingNotes.employeeId, employees.id))
    .where(employeeId ? eq(coachingNotes.employeeId, employeeId) : undefined)
    .orderBy(desc(coachingNotes.date));
}

export async function createCoaching(
  input: {
    employeeId: string;
    date: string;
    type?: string;
    topic: string;
    notes?: string;
    nextAction?: string;
    followUpAt?: string;
  },
  actor: AuthUser
) {
  const [row] = await db
    .insert(coachingNotes)
    .values({
      employeeId: input.employeeId,
      date: input.date,
      type: (input.type ?? "COACHING") as never,
      topic: input.topic,
      notes: input.notes ?? null,
      nextAction: input.nextAction ?? null,
      followUpAt: input.followUpAt ?? null,
    })
    .returning({ id: coachingNotes.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "coaching_note",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function listRewards(periodStart?: string, periodEnd?: string) {
  return db
    .select({
      id: rewards.id,
      employeeId: rewards.employeeId,
      employeeName: employees.name,
      periodStart: rewards.periodStart,
      periodEnd: rewards.periodEnd,
      type: rewards.type,
      amount: rewards.amount,
      reason: rewards.reason,
    })
    .from(rewards)
    .leftJoin(employees, eq(rewards.employeeId, employees.id))
    .where(
      periodStart && periodEnd
        ? and(gte(rewards.periodStart, periodStart), lte(rewards.periodEnd, periodEnd))
        : undefined
    )
    .orderBy(desc(rewards.periodStart));
}

export async function createReward(
  input: { employeeId: string; periodStart: string; periodEnd: string; type?: string; amount?: string; reason: string },
  actor: AuthUser
) {
  const [row] = await db
    .insert(rewards)
    .values({
      employeeId: input.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      type: (input.type ?? "BONUS") as never,
      amount: input.amount ? BigInt(input.amount) : null,
      reason: input.reason,
      approvedBy: actor.id,
    })
    .returning({ id: rewards.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "reward",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function listCorrectiveActions(status?: string) {
  return db
    .select({
      id: correctiveActions.id,
      employeeId: correctiveActions.employeeId,
      employeeName: employees.name,
      issue: correctiveActions.issue,
      actionPlan: correctiveActions.actionPlan,
      dueDate: correctiveActions.dueDate,
      status: correctiveActions.status,
      periodStart: correctiveActions.periodStart,
      periodEnd: correctiveActions.periodEnd,
    })
    .from(correctiveActions)
    .leftJoin(employees, eq(correctiveActions.employeeId, employees.id))
    .where(status ? eq(correctiveActions.status, status as never) : undefined)
    .orderBy(correctiveActions.dueDate);
}

export async function createCorrectiveAction(
  input: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    issue: string;
    actionPlan: string;
    dueDate: string;
  },
  actor: AuthUser
) {
  const [row] = await db
    .insert(correctiveActions)
    .values({
      employeeId: input.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      issue: input.issue,
      actionPlan: input.actionPlan,
      dueDate: input.dueDate,
    })
    .returning({ id: correctiveActions.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "corrective_action",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateCorrectiveStatus(id: string, status: string, actor: AuthUser) {
  const before = await db.select().from(correctiveActions).where(eq(correctiveActions.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Tindakan korektif tidak ditemukan.");
  await db
    .update(correctiveActions)
    .set({
      status: status as never,
      ...(status === "VERIFIED" ? { verifiedBy: actor.id } : {}),
    })
    .where(eq(correctiveActions.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "corrective_action",
    entityId: id,
    before: { status: before[0].status },
    after: { status },
  });
}

/** Pilih karyawan aktif untuk form coaching/reward/PIP. */
export async function employeeOptions(): Promise<Array<{ id: string; name: string; position: string | null }>> {
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      position: sql<string | null>`(select name from positions where id = ${employees.positionId})`,
    })
    .from(employees)
    .where(and(isNull(employees.deletedAt), inArray(employees.status, ["AKTIF", "CUTI"])))
    .orderBy(employees.name);
  return rows;
}
