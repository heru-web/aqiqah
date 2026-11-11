"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { defaultBranchId, requirePermission } from "@/lib/server/auth";
import {
  createBusinessUnit,
  updateBusinessUnit,
  createDepartment,
  updateDepartment,
  createPosition,
  updatePosition,
  createSalesChannel,
  updateSalesChannel,
  createMarketingSpend,
  createKpiIndicator,
  updateKpiIndicator,
  upsertKpiTarget,
  upsertKpiActual,
  submitKpiActual,
  verifyKpiActual,
  deleteKpiIndicator,
  copyKpiTargets,
} from "@/server/services/performance";
import { runKpiActuals } from "@/server/services/kpi-runner";
import {
  saveDailyScorecard,
  submitDailyScorecard,
  verifyDailyScorecard,
  saveWeeklyReview,
  finalizeWeeklyReview,
} from "@/server/services/scorecards";
import {
  generateMonthlyReview,
  submitMonthlyReview,
  approveMonthlyReview,
  computeEmployeePerformances,
} from "@/server/services/monthly-review";

export type MasterFormState = { error?: string; success?: boolean } | undefined;

function f(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function msg(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

// ── Business Units ─────────────────────────────────────────────────
export async function createBusinessUnitAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.master.create");
    await createBusinessUnit(
      { code: f(fd, "code"), name: f(fd, "name"), description: f(fd, "description") || undefined },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan unit usaha.") };
  }
  revalidatePath("/data-induk/unit-usaha");
  return { success: true };
}

export async function updateBusinessUnitAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.master.update");
    await updateBusinessUnit(
      id,
      {
        name: f(fd, "name") || undefined,
        description: f(fd, "description") || undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui unit usaha.") };
  }
  revalidatePath("/data-induk/unit-usaha");
  return { success: true };
}

// ── Departments ────────────────────────────────────────────────────
export async function createDepartmentAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.master.create");
    await createDepartment(
      { code: f(fd, "code"), name: f(fd, "name"), businessUnitId: f(fd, "businessUnitId") || undefined },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan departemen.") };
  }
  revalidatePath("/data-induk/departemen");
  return { success: true };
}

export async function updateDepartmentAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.master.update");
    await updateDepartment(
      id,
      {
        name: f(fd, "name") || undefined,
        businessUnitId: f(fd, "businessUnitId") || undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui departemen.") };
  }
  revalidatePath("/data-induk/departemen");
  return { success: true };
}

// ── Positions ──────────────────────────────────────────────────────
export async function createPositionAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.master.create");
    await createPosition(
      { code: f(fd, "code"), name: f(fd, "name"), departmentId: f(fd, "departmentId") },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan jabatan.") };
  }
  revalidatePath("/data-induk/jabatan");
  return { success: true };
}

export async function updatePositionAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.master.update");
    await updatePosition(
      id,
      {
        name: f(fd, "name") || undefined,
        departmentId: f(fd, "departmentId") || undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui jabatan.") };
  }
  revalidatePath("/data-induk/jabatan");
  return { success: true };
}

// ── Sales Channels ─────────────────────────────────────────────────
export async function createSalesChannelAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.master.create");
    await createSalesChannel(
      { code: f(fd, "code"), name: f(fd, "name"), type: f(fd, "type") as "ONLINE" | "OFFLINE" },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan saluran.") };
  }
  revalidatePath("/data-induk/saluran");
  return { success: true };
}

export async function updateSalesChannelAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.master.update");
    await updateSalesChannel(
      id,
      {
        name: f(fd, "name") || undefined,
        type: (f(fd, "type") || undefined) as "ONLINE" | "OFFLINE" | undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui saluran.") };
  }
  revalidatePath("/data-induk/saluran");
  return { success: true };
}

export async function createMarketingSpendAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const actor = await requirePermission("performance.master.create");
  const channelId = f(fd, "channelId");
  const periodStart = f(fd, "periodStart");
  const periodEnd = f(fd, "periodEnd");
  const amountRaw = f(fd, "amount").replace(/[^\d-]/g, "");
  const amount = BigInt(amountRaw || "0");
  if (!channelId) return { error: "Saluran wajib dipilih." };
  if (!periodStart || !periodEnd) return { error: "Periode mulai dan akhir wajib diisi." };
  if (amount <= BigInt(0)) return { error: "Nominal spend wajib lebih dari 0." };
  try {
    await createMarketingSpend(
      { channelId, periodStart, periodEnd, amount, notes: f(fd, "notes") || null },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan spend iklan.") };
  }
  revalidatePath("/kinerja/marketing");
  return { success: true };
}

// ── KPI Indicators ─────────────────────────────────────────────────
export async function createKpiIndicatorAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.indicators.create");
    await createKpiIndicator(
      {
        code: f(fd, "code"),
        name: f(fd, "name"),
        scope: f(fd, "scope"),
        unit: f(fd, "unit"),
        direction: f(fd, "direction"),
        frequency: f(fd, "frequency"),
        formulaKey: f(fd, "formulaKey") || undefined,
        defaultScopeRefId: f(fd, "defaultScopeRefId") || undefined,
        description: f(fd, "description") || undefined,
        defaultWeight: f(fd, "defaultWeight") || "0",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan indikator KPI.") };
  }
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

export async function updateKpiIndicatorAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.indicators.update");
    await updateKpiIndicator(
      id,
      {
        name: f(fd, "name") || undefined,
        unit: f(fd, "unit") || undefined,
        direction: f(fd, "direction") || undefined,
        frequency: f(fd, "frequency") || undefined,
        formulaKey: f(fd, "formulaKey") || undefined,
        defaultScopeRefId: f(fd, "defaultScopeRefId") || undefined,
        description: f(fd, "description") || undefined,
        defaultWeight: f(fd, "defaultWeight") || undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui indikator KPI.") };
  }
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

// ── KPI Targets ────────────────────────────────────────────────────
export async function upsertKpiTargetAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.targets.create");
    await upsertKpiTarget(
      {
        indicatorId: f(fd, "indicatorId"),
        scopeRefId: f(fd, "scopeRefId") || undefined,
        periodType: f(fd, "periodType") || undefined,
        periodStart: f(fd, "periodStart"),
        periodEnd: f(fd, "periodEnd"),
        targetValue: f(fd, "targetValue") || "0",
        weight: f(fd, "weight") || "0",
        notes: f(fd, "notes") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan target KPI.") };
  }
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

// ── KPI Actuals ────────────────────────────────────────────────────
export async function upsertKpiActualAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.actuals.create");
    await upsertKpiActual(
      {
        indicatorId: f(fd, "indicatorId"),
        scopeRefId: f(fd, "scopeRefId") || undefined,
        periodType: f(fd, "periodType") || undefined,
        periodStart: f(fd, "periodStart"),
        periodEnd: f(fd, "periodEnd"),
        actualValue: f(fd, "actualValue") || "0",
        source: "MANUAL",
        notes: f(fd, "notes") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan aktual KPI.") };
  }
  revalidatePath("/kinerja");
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

export async function submitKpiActualAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.actuals.update");
    await submitKpiActual(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal mengajukan aktual KPI.") };
  }
  revalidatePath("/kinerja");
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

export async function verifyKpiActualAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.actuals.action");
    await verifyKpiActual(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal memverifikasi aktual KPI.") };
  }
  revalidatePath("/kinerja");
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

export async function deleteKpiIndicatorAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.indicators.delete");
    await deleteKpiIndicator(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menghapus indikator KPI.") };
  }
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

export async function copyKpiTargetsAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const from = f(fd, "from");
  const to = f(fd, "to");
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return { error: "Periode tidak valid." };
  }
  try {
    const actor = await requirePermission("performance.targets.create");
    const created = await copyKpiTargets(monthRangeOf(from), monthRangeOf(to), actor);
    if (created === 0) return { success: true };
  } catch (err) {
    return { error: msg(err, "Gagal menyalin target.") };
  }
  revalidatePath("/kinerja/pengaturan");
  return { success: true };
}

function monthRangeOf(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export interface SyncResult {
  computed?: number;
  updated?: number;
  skippedManual?: number;
  nulls?: number;
  error?: string;
}

/** Sinkronkan aktual AUTO dari formula ERP (dipakai tombol UI & cron API). */
export async function runKpiSyncAction(): Promise<SyncResult> {
  try {
    await requirePermission("performance.actuals.action");
    const res = await runKpiActuals();
    revalidatePath("/kinerja");
    revalidatePath("/kinerja/pengaturan");
    return { computed: res.computed, updated: res.updated, skippedManual: res.skippedManual, nulls: res.nulls };
  } catch (err) {
    return { error: msg(err, "Gagal menyinkronkan KPI.") };
  }
}

// ── Scorecard Harian ───────────────────────────────────────────────
export async function saveDailyScorecardAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const date = f(fd, "date");
  const departmentId = f(fd, "departmentId");
  if (!date || !departmentId) return { error: "Tanggal/departemen tidak valid." };
  let lines: Array<{
    indicatorId: string;
    actualValue: string;
    targetValue?: string;
    weight?: string;
    notes?: string;
  }>;
  try {
    lines = JSON.parse(f(fd, "lines") || "[]");
    if (!Array.isArray(lines)) throw new Error("bukan array");
  } catch {
    return { error: "Data baris scorecard tidak valid." };
  }
  try {
    const actor = await requirePermission(fd.get("id") ? "performance.scorecards.update" : "performance.scorecards.create");
    const branchId = actor.branchId ?? (await defaultBranchId());
    if (!branchId) return { error: "Cabang belum ditetapkan." };
    await saveDailyScorecard({ branchId, date, departmentId, lines, notes: f(fd, "notes") || undefined }, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan scorecard harian.") };
  }
  revalidatePath("/kinerja/harian");
  return { success: true };
}

export async function submitDailyScorecardAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.scorecards.update");
    await submitDailyScorecard(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal mengajukan scorecard.") };
  }
  revalidatePath("/kinerja/harian");
  return { success: true };
}

export async function verifyDailyScorecardAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.scorecards.action");
    await verifyDailyScorecard(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal memverifikasi scorecard.") };
  }
  revalidatePath("/kinerja/harian");
  return { success: true };
}

// ── Review Mingguan ────────────────────────────────────────────────
export async function saveWeeklyReviewAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const weekStart = f(fd, "weekStart");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Minggu tidak valid." };
  let decisions: unknown;
  try {
    decisions = JSON.parse(f(fd, "decisions") || "[]");
  } catch {
    return { error: "Data action item tidak valid." };
  }
  try {
    const actor = await requirePermission("performance.weekly.update");
    const branchId = actor.branchId ?? (await defaultBranchId());
    if (!branchId) return { error: "Cabang belum ditetapkan." };
    await saveWeeklyReview({ branchId, weekStart, decisions }, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan review mingguan.") };
  }
  revalidatePath("/kinerja/mingguan");
  return { success: true };
}

export async function finalizeWeeklyReviewAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.weekly.action");
    await finalizeWeeklyReview(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal mem-final-kan review mingguan.") };
  }
  revalidatePath("/kinerja/mingguan");
  return { success: true };
}

// ── Review Bulanan ─────────────────────────────────────────────────
export async function generateMonthlyReviewAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const period = f(fd, "period");
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Periode tidak valid." };
  try {
    const actor = await requirePermission("performance.monthly.create");
    const branchId = actor.branchId ?? (await defaultBranchId());
    if (!branchId) return { error: "Cabang belum ditetapkan." };
    const range = monthRangeOf(period);
    await generateMonthlyReview({ branchId, periodStart: range.start, periodEnd: range.end }, actor);
  } catch (err) {
    return { error: msg(err, "Gagal membuat review bulanan.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function submitMonthlyReviewAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.update");
    await submitMonthlyReview(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal mengajukan review bulanan.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function approveMonthlyReviewAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.action");
    await approveMonthlyReview(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menyetujui review bulanan.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function recomputeEmployeePerformancesAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const period = f(fd, "period");
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Periode tidak valid." };
  try {
    const actor = await requirePermission("performance.individual.update");
    const range = monthRangeOf(period);
    await computeEmployeePerformances(range.start, range.end, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menghitung skor individu.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}
