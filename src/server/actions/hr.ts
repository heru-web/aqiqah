"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import {
  archiveEmployee,
  createEmployee,
  createSop,
  saveAttendanceForDate,
  saveSopChecks,
  updateEmployee,
  updateSop,
} from "@/server/services/hr";
import {
  createCoaching,
  createCorrectiveAction,
  createReward,
  updateCorrectiveStatus,
} from "@/server/services/monthly-review";

type MasterFormState = { error?: string; success?: boolean } | undefined;

function f(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function msg(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

// ── Karyawan ───────────────────────────────────────────────────────
export async function createEmployeeAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("employees.employees.create");
    await createEmployee(
      {
        name: f(fd, "name"),
        employeeNumber: f(fd, "employeeNumber") || undefined,
        positionId: f(fd, "positionId") || undefined,
        departmentId: f(fd, "departmentId") || undefined,
        joinedAt: f(fd, "joinedAt") || undefined,
        phone: f(fd, "phone") || undefined,
        status: f(fd, "status") || undefined,
        basicSalary: f(fd, "basicSalary") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan karyawan.") };
  }
  revalidatePath("/karyawan");
  return { success: true };
}

export async function updateEmployeeAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("employees.employees.update");
    await updateEmployee(
      id,
      {
        name: f(fd, "name") || undefined,
        employeeNumber: f(fd, "employeeNumber") || undefined,
        positionId: f(fd, "positionId"),
        departmentId: f(fd, "departmentId"),
        joinedAt: f(fd, "joinedAt"),
        phone: f(fd, "phone") || undefined,
        status: f(fd, "status") || undefined,
        basicSalary: f(fd, "basicSalary") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui karyawan.") };
  }
  revalidatePath("/karyawan");
  return { success: true };
}

export async function archiveEmployeeAction(id: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("employees.employees.delete");
    await archiveEmployee(id, actor);
  } catch (err) {
    return { error: msg(err, "Gagal mengarsipkan karyawan.") };
  }
  revalidatePath("/karyawan");
  return { success: true };
}

/** Arsipkan banyak karyawan sekaligus (dipakai toolbar aksi massal tabel). */
export async function archiveEmployeesAction(ids: string[]): Promise<MasterFormState> {
  if (!Array.isArray(ids) || ids.length === 0) return { error: "Tidak ada karyawan dipilih." };
  try {
    const actor = await requirePermission("employees.employees.delete");
    for (const id of ids) {
      await archiveEmployee(id, actor);
    }
  } catch (err) {
    return { error: msg(err, "Gagal mengarsipkan karyawan terpilih.") };
  }
  revalidatePath("/karyawan");
  return { success: true };
}

// ── Absensi ────────────────────────────────────────────────────────
export async function saveAttendanceAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const date = f(fd, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tanggal tidak valid." };
  let entries: Array<{ employeeId: string; status: string; lateMinutes?: number; notes?: string }>;
  try {
    entries = JSON.parse(f(fd, "entries") || "[]");
    if (!Array.isArray(entries)) throw new Error("bukan array");
  } catch {
    return { error: "Data absensi tidak valid." };
  }
  try {
    const actor = await requirePermission("attendance.attendance.update");
    await saveAttendanceForDate(date, entries, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan absensi.") };
  }
  revalidatePath("/attendance");
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

// ── SOP ────────────────────────────────────────────────────────────
export async function createSopAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.master.create");
    await createSop(
      {
        code: f(fd, "code"),
        title: f(fd, "title"),
        departmentId: f(fd, "departmentId") || undefined,
        version: f(fd, "version") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan SOP.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function updateSopAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const id = f(fd, "id");
  if (!id) return { error: "ID tidak valid." };
  try {
    const actor = await requirePermission("performance.master.update");
    await updateSop(
      id,
      {
        title: f(fd, "title") || undefined,
        departmentId: f(fd, "departmentId"),
        version: f(fd, "version") || undefined,
        isActive: f(fd, "isActive") === "true",
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui SOP.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function saveSopChecksAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  const periodStart = f(fd, "periodStart");
  const periodEnd = f(fd, "periodEnd");
  if (!periodStart || !periodEnd) return { error: "Periode tidak valid." };
  let entries: Array<{ sopId: string; employeeId: string; score: string; notes?: string }>;
  try {
    entries = JSON.parse(f(fd, "entries") || "[]");
    if (!Array.isArray(entries)) throw new Error("bukan array");
  } catch {
    return { error: "Data pengecekan SOP tidak valid." };
  }
  try {
    const actor = await requirePermission("performance.monthly.update");
    await saveSopChecks(periodStart, periodEnd, entries, actor);
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan pengecekan SOP.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

// ── Coaching · Reward · PIP ────────────────────────────────────────
export async function createCoachingAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.create");
    await createCoaching(
      {
        employeeId: f(fd, "employeeId"),
        date: f(fd, "date"),
        type: f(fd, "type") || undefined,
        topic: f(fd, "topic"),
        notes: f(fd, "notes") || undefined,
        nextAction: f(fd, "nextAction") || undefined,
        followUpAt: f(fd, "followUpAt") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan catatan coaching.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function createRewardAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.create");
    await createReward(
      {
        employeeId: f(fd, "employeeId"),
        periodStart: f(fd, "periodStart"),
        periodEnd: f(fd, "periodEnd"),
        type: f(fd, "type") || undefined,
        amount: f(fd, "amount") || undefined,
        reason: f(fd, "reason"),
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan reward.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function createCorrectiveActionAction(_p: MasterFormState, fd: FormData): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.create");
    await createCorrectiveAction(
      {
        employeeId: f(fd, "employeeId"),
        periodStart: f(fd, "periodStart"),
        periodEnd: f(fd, "periodEnd"),
        issue: f(fd, "issue"),
        actionPlan: f(fd, "actionPlan"),
        dueDate: f(fd, "dueDate"),
      },
      actor
    );
  } catch (err) {
    return { error: msg(err, "Gagal menyimpan tindakan korektif.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}

export async function updateCorrectiveStatusAction(id: string, status: string): Promise<MasterFormState> {
  try {
    const actor = await requirePermission("performance.monthly.update");
    await updateCorrectiveStatus(id, status, actor);
  } catch (err) {
    return { error: msg(err, "Gagal memperbarui status tindakan korektif.") };
  }
  revalidatePath("/kinerja/bulanan");
  return { success: true };
}
