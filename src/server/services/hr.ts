import "server-only";
import { assertResourceAccess } from "@/lib/server/resource-access";
import { ValidationError } from "@/lib/errors";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, departments, employees, positions, sopChecks, sops } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import { firstRow } from "@/lib/server/sql-helpers";

function defined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── Karyawan ───────────────────────────────────────────────────────
export interface EmployeeRow {
  id: string;
  employeeNumber: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  joinedAt: string | null;
  status: string;
  phone: string | null;
  basicSalary: string | null;
  userId: string | null;
}

export async function listEmployees(opts?: { includeArchived?: boolean; departmentId?: string; search?: string; branchId?: string | null }) {
  const conds = [opts?.includeArchived ? undefined : isNull(employees.deletedAt), opts?.branchId ? eq(employees.branchId, opts.branchId) : undefined];
  if (opts?.departmentId) conds.push(eq(employees.departmentId, opts.departmentId));
  const rows = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      name: employees.name,
      positionId: employees.positionId,
      positionName: positions.name,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      joinedAt: employees.joinedAt,
      status: employees.status,
      phone: employees.phone,
      basicSalary: employees.basicSalary,
      userId: employees.userId,
      deletedAt: employees.deletedAt,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...conds))
    .orderBy(employees.employeeNumber);

  const q = opts?.search?.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.employeeNumber.toLowerCase().includes(q)
      )
    : rows;
  return filtered.map((r) => ({ ...r, basicSalary: r.basicSalary ? String(r.basicSalary) : null }));
}

async function nextEmployeeNumber(): Promise<string> {
  const row = await firstRow<{ n: number }>(sql`select count(*)::int + 1 as n from employees`);
  const n = row?.n ?? 1;
  return `K-${String(n).padStart(4, "0")}`;
}

export async function createEmployee(
  input: {
    name: string;
    employeeNumber?: string;
    positionId?: string;
    departmentId?: string;
    joinedAt?: string;
    phone?: string;
    status?: string;
    basicSalary?: string;
  },
  actor: AuthUser
) {
  const employeeNumber = input.employeeNumber?.trim() || (await nextEmployeeNumber());
  const dup = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.employeeNumber, employeeNumber));
  if (dup.length > 0) throw new ConflictError(`Nomor karyawan "${employeeNumber}" sudah dipakai.`);

  const [row] = await db
    .insert(employees)
    .values({
      employeeNumber,
      name: input.name,
      positionId: input.positionId || null,
      departmentId: input.departmentId || null,
      joinedAt: input.joinedAt || null,
      phone: input.phone || null,
      status: (input.status ?? "AKTIF") as never,
      basicSalary: input.basicSalary ? BigInt(input.basicSalary) : null,
      branchId: (actor.branchId ?? (await firstBranchId())) as string,
    })
    .returning({ id: employees.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "employees",
    entityType: "employee",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

async function firstBranchId(): Promise<string> {
  const r = await firstRow<{ id: string }>(sql`select id from branches where is_active = true limit 1`);
  if (!r) throw new ConflictError("Belum ada cabang aktif.");
  return r.id;
}

export async function updateEmployee(
  id: string,
  input: Partial<{
    name: string;
    employeeNumber: string;
    positionId: string;
    departmentId: string;
    joinedAt: string;
    phone: string;
    status: string;
    basicSalary: string;
    userId: string;
  }>,
  actor: AuthUser
) {
  await assertResourceAccess("employee", id, actor);
  const before = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .limit(1);
  if (before.length === 0) throw new NotFoundError("Karyawan tidak ditemukan.");
  if (input.employeeNumber) {
    const dup = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.employeeNumber, input.employeeNumber), sql`${employees.id} <> ${id}`));
    if (dup.length > 0) throw new ConflictError(`Nomor karyawan "${input.employeeNumber}" sudah dipakai.`);
  }
  const patch: Record<string, unknown> = defined(input as Record<string, unknown>);
  if (input.basicSalary !== undefined) patch.basicSalary = input.basicSalary ? BigInt(input.basicSalary) : null;
  await db.update(employees).set(patch).where(eq(employees.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "employees",
    entityType: "employee",
    entityId: id,
    before: before[0],
    after: input,
  });
}

/** Arsipkan karyawan (soft delete + status RESIGN). */
export async function archiveEmployee(id: string, actor: AuthUser) {
  await assertResourceAccess("employee", id, actor);
  const before = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Karyawan tidak ditemukan.");
  await db
    .update(employees)
    .set({ deletedAt: new Date(), status: "RESIGN" })
    .where(eq(employees.id, id));
  await insertAudit(db, {
    actor,
    action: "DELETE",
    module: "employees",
    entityType: "employee",
    entityId: id,
    before: { status: before[0].status },
    after: { status: "RESIGN", archived: true },
  });
}

// ── Absensi ────────────────────────────────────────────────────────
export interface AttendanceEntry {
  employeeId: string;
  status: string;
  lateMinutes?: number;
  notes?: string;
}

export async function listAttendanceForDate(date: string, branchId?: string | null) {
  const staff = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      name: employees.name,
      positionName: positions.name,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(isNull(employees.deletedAt), sql`${employees.status} in ('AKTIF','CUTI')`, branchId ? eq(employees.branchId, branchId) : undefined))
    .orderBy(employees.employeeNumber);

  const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.date, date));
  const byEmp = new Map(records.map((r) => [r.employeeId, r]));

  return staff.map((s) => {
    const r = byEmp.get(s.id);
    return {
      ...s,
      recordId: r?.id ?? null,
      status: r?.status ?? null,
      lateMinutes: r?.lateMinutes ?? 0,
      notes: r?.notes ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
    };
  });
}

/** Simpan absensi satu tanggal (bulk upsert, idempoten per karyawan+tanggal). */
export async function saveAttendanceForDate(date: string, entries: AttendanceEntry[], actor: AuthUser) {
  for (const e of entries) {
    await assertResourceAccess("employee", e.employeeId, actor);
    if (!["HADIR", "TERLAMBAT", "ALPA", "IZIN", "SAKIT"].includes(e.status)) throw new ValidationError("Status absensi tidak valid.");
  }
  let saved = 0;
  for (const e of entries) {
    const existing = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employeeId, e.employeeId), eq(attendanceRecords.date, date)))
      .limit(1);
    const late = e.status === "TERLAMBAT" ? (e.lateMinutes && e.lateMinutes > 0 ? e.lateMinutes : 1) : 0;
    if (existing.length > 0) {
      await db
        .update(attendanceRecords)
        .set({ status: e.status as never, lateMinutes: late, notes: e.notes ?? null })
        .where(eq(attendanceRecords.id, existing[0].id));
    } else {
      await db.insert(attendanceRecords).values({
        employeeId: e.employeeId,
        date,
        status: e.status as never,
        lateMinutes: late,
        notes: e.notes ?? null,
      });
    }
    saved++;
  }
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "attendance",
    entityType: "attendance",
    entityId: date,
    metadata: { records: saved },
  });
  return saved;
}

export interface AttendanceRecapRow {
  employeeId: string;
  employeeNumber: string;
  name: string;
  positionName: string | null;
  hadir: number;
  terlambat: number;
  alpa: number;
  izin: number;
  sakit: number;
  total: number;
}

export async function attendanceRecap(start: string, end: string, branchId?: string | null): Promise<AttendanceRecapRow[]> {
  const staff = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      name: employees.name,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(isNull(employees.deletedAt), sql`${employees.status} <> 'RESIGN'`))
    .orderBy(employees.employeeNumber);

  const agg = await db
    .select({
      employeeId: attendanceRecords.employeeId,
      status: attendanceRecords.status,
      n: sql<number>`count(*)::int`,
    })
    .from(attendanceRecords)
    .where(and(gte(attendanceRecords.date, start), lte(attendanceRecords.date, end)))
    .groupBy(attendanceRecords.employeeId, attendanceRecords.status);

  const byEmp = new Map<string, Record<string, number>>();
  for (const a of agg) {
    const m = byEmp.get(a.employeeId) ?? {};
    m[a.status] = a.n;
    byEmp.set(a.employeeId, m);
  }

  return staff.map((s) => {
    const m = byEmp.get(s.id) ?? {};
    const hadir = m.HADIR ?? 0;
    const terlambat = m.TERLAMBAT ?? 0;
    const alpa = m.ALPA ?? 0;
    const izin = m.IZIN ?? 0;
    const sakit = m.SAKIT ?? 0;
    return {
      employeeId: s.id,
      employeeNumber: s.employeeNumber,
      name: s.name,
      positionName: s.positionName,
      hadir,
      terlambat,
      alpa,
      izin,
      sakit,
      total: hadir + terlambat + alpa + izin + sakit,
    };
  });
}

// ── SOP ────────────────────────────────────────────────────────────
export async function listSops(includeInactive = false) {
  return db
    .select({
      id: sops.id,
      code: sops.code,
      title: sops.title,
      departmentId: sops.departmentId,
      departmentName: departments.name,
      version: sops.version,
      isActive: sops.isActive,
    })
    .from(sops)
    .leftJoin(departments, eq(sops.departmentId, departments.id))
    .where(includeInactive ? undefined : eq(sops.isActive, true))
    .orderBy(sops.code);
}

export async function createSop(
  input: { code: string; title: string; departmentId?: string; version?: string },
  actor: AuthUser
) {
  const code = input.code.toUpperCase();
  const dup = await db.select({ id: sops.id }).from(sops).where(eq(sops.code, code));
  if (dup.length > 0) throw new ConflictError(`Kode SOP "${code}" sudah dipakai.`);
  const [row] = await db
    .insert(sops)
    .values({
      code,
      title: input.title,
      departmentId: input.departmentId || null,
      version: input.version ?? "1.0",
    })
    .returning({ id: sops.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "performance",
    entityType: "sop",
    entityId: row.id,
    after: input,
  });
  return row.id;
}

export async function updateSop(
  id: string,
  input: Partial<{ title: string; departmentId: string; version: string; isActive: boolean }>,
  actor: AuthUser
) {
  const before = await db.select().from(sops).where(eq(sops.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("SOP tidak ditemukan.");
  await db
    .update(sops)
    .set(defined({ ...input, departmentId: input.departmentId === "" ? null : input.departmentId }))
    .where(eq(sops.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "sop",
    entityId: id,
    before: before[0],
    after: input,
  });
}

export interface SopCheckEntry {
  sopId: string;
  employeeId: string;
  score: string;
  notes?: string;
}

/** Simpan pengecekan SOP satu periode (bulk upsert). */
export async function saveSopChecks(
  periodStart: string,
  periodEnd: string,
  entries: SopCheckEntry[],
  actor: AuthUser
) {
  let saved = 0;
  for (const e of entries) {
    const existing = await db
      .select({ id: sopChecks.id })
      .from(sopChecks)
      .where(
        and(
          eq(sopChecks.sopId, e.sopId),
          eq(sopChecks.employeeId, e.employeeId),
          eq(sopChecks.periodStart, periodStart),
          eq(sopChecks.periodEnd, periodEnd)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(sopChecks)
        .set({ score: e.score, notes: e.notes ?? null, checkedBy: actor.id })
        .where(eq(sopChecks.id, existing[0].id));
    } else {
      await db.insert(sopChecks).values({
        sopId: e.sopId,
        employeeId: e.employeeId,
        periodStart,
        periodEnd,
        score: e.score,
        notes: e.notes ?? null,
        checkedBy: actor.id,
      });
    }
    saved++;
  }
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "performance",
    entityType: "sop_check",
    entityId: `${periodStart}→${periodEnd}`,
    metadata: { records: saved },
  });
  return saved;
}

/** Rata-rata skor SOP per karyawan pada periode. */
export async function sopScoresByEmployee(periodStart: string, periodEnd: string) {
  const rows = await db
    .select({
      employeeId: sopChecks.employeeId,
      avg: sql<string>`avg(${sopChecks.score})::float8`,
      n: sql<number>`count(*)::int`,
    })
    .from(sopChecks)
    .where(and(gte(sopChecks.periodStart, periodStart), lte(sopChecks.periodEnd, periodEnd)))
    .groupBy(sopChecks.employeeId);
  const map = new Map<string, { score: number; count: number }>();
  for (const r of rows) map.set(r.employeeId, { score: Math.round(Number(r.avg) * 100) / 100, count: r.n });
  return map;
}

export async function listSopChecks(periodStart: string, periodEnd: string) {
  return db
    .select({
      id: sopChecks.id,
      sopId: sopChecks.sopId,
      sopCode: sops.code,
      sopTitle: sops.title,
      employeeId: sopChecks.employeeId,
      score: sopChecks.score,
      notes: sopChecks.notes,
    })
    .from(sopChecks)
    .innerJoin(sops, eq(sopChecks.sopId, sops.id))
    .where(and(gte(sopChecks.periodStart, periodStart), lte(sopChecks.periodEnd, periodEnd)))
    .orderBy(sops.code);
}

/** Rekap kehadiran ringkas 1 bulan untuk formula attendance_rate (bila dipakai). */
export async function attendanceCountsForEmployees(periodStart: string, periodEnd: string) {
  const agg = await db
    .select({
      employeeId: attendanceRecords.employeeId,
      status: attendanceRecords.status,
      n: sql<number>`count(*)::int`,
    })
    .from(attendanceRecords)
    .where(and(gte(attendanceRecords.date, periodStart), lte(attendanceRecords.date, periodEnd)))
    .groupBy(attendanceRecords.employeeId, attendanceRecords.status);
  const map = new Map<string, Record<string, number>>();
  for (const a of agg) {
    const m = map.get(a.employeeId) ?? {};
    m[a.status] = a.n;
    map.set(a.employeeId, m);
  }
  return map;
}

export async function latestEmployeesForCoach(): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(isNull(employees.deletedAt), eq(employees.status, "AKTIF")))
    .orderBy(desc(employees.name));
  return rows;
}
