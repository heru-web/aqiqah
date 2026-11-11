import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { kitchenTasks, periodClosings } from "@/db/schema/erp-extensions";
import { branches, users } from "@/db/schema";
import { orders } from "@/db/schema/sales";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

/* ── Tugas dapur ─────────────────────────────────────────────── */

export async function listKitchenTasks(filter: { branchId?: string | null; status?: string; limit?: number } = {}) {
  return db
    .select({
      task: kitchenTasks,
      orderNumber: orders.orderNumber,
      branchName: branches.name,
    })
    .from(kitchenTasks)
    .leftJoin(orders, eq(kitchenTasks.orderId, orders.id))
    .leftJoin(branches, eq(kitchenTasks.branchId, branches.id))
    .where(
      and(
        filter.branchId ? eq(kitchenTasks.branchId, filter.branchId) : undefined,
        filter.status === "MENUNGGU" || filter.status === "SIAP" ? eq(kitchenTasks.status, filter.status) : undefined
      )
    )
    .orderBy(desc(kitchenTasks.createdAt))
    .limit(filter.limit ?? 40);
}

export async function kitchenSummary(branchId?: string | null) {
  const rows = await db
    .select({ status: kitchenTasks.status, n: sql<number>`count(*)::int` })
    .from(kitchenTasks)
    .where(branchId ? eq(kitchenTasks.branchId, branchId) : undefined)
    .groupBy(kitchenTasks.status);
  let total = 0;
  let menunggu = 0;
  let siap = 0;
  for (const r of rows) {
    const n = Number(r.n);
    total += n;
    if (r.status === "MENUNGGU") menunggu += n;
    if (r.status === "SIAP") siap += n;
  }
  return { total, menunggu, siap };
}

export async function setKitchenTaskStatus(id: string, status: "MENUNGGU" | "SIAP", actor: AuthUser): Promise<void> {
  if (!["MENUNGGU", "SIAP"].includes(status)) throw new ValidationError("Status tugas dapur tidak valid.");
  const [before] = await db.select().from(kitchenTasks).where(eq(kitchenTasks.id, id)).limit(1);
  if (!before) throw new NotFoundError("Tugas dapur tidak ditemukan.");
  await db
    .update(kitchenTasks)
    .set({ status, doneAt: status === "SIAP" ? new Date() : null, doneBy: status === "SIAP" ? actor.id : null })
    .where(eq(kitchenTasks.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "production",
    entityType: "kitchen_task",
    entityId: id,
    before: { status: before.status },
    after: { status },
  });
}

/* ── Penutupan periode ───────────────────────────────────────── */

export async function listPeriodClosings(limit = 12) {
  return db
    .select({ closing: periodClosings, userName: users.name })
    .from(periodClosings)
    .leftJoin(users, eq(periodClosings.closedBy, users.id))
    .orderBy(desc(periodClosings.period))
    .limit(limit);
}

export async function isPeriodClosed(period: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  const rows = await db.select({ id: periodClosings.id }).from(periodClosings).where(eq(periodClosings.period, period));
  return rows.length > 0;
}

export async function closePeriod(period: string, note: string | undefined, actor: AuthUser): Promise<string> {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new ValidationError("Format periode harus YYYY-MM.");
  const existing = await db.select({ id: periodClosings.id }).from(periodClosings).where(eq(periodClosings.period, period));
  if (existing.length > 0) throw new ConflictError(`Periode ${period} sudah ditutup.`);
  const [row] = await db.insert(periodClosings).values({ period, note: note?.trim() || null, closedBy: actor.id }).returning({ id: periodClosings.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "accounting",
    entityType: "period_closing",
    entityId: row.id,
    after: { period, note: note?.trim() ?? null },
  });
  return row.id;
}

export async function reopenPeriod(id: string, reason: string | undefined, actor: AuthUser): Promise<void> {
  const before = await db.select().from(periodClosings).where(eq(periodClosings.id, id)).limit(1);
  if (before.length === 0) throw new NotFoundError("Penutupan periode tidak ditemukan.");
  await db.delete(periodClosings).where(eq(periodClosings.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "accounting",
    entityType: "period_closing",
    entityId: id,
    before: before[0],
    after: { reopened: true, reason: reason?.trim() ?? null },
  });
}
