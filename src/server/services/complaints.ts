import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, customerComplaints, customers, orders } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export const COMPLAINT_SEVERITIES = ["RENDAH", "SEDANG", "TINGGI"] as const;
export const COMPLAINT_STATUSES = ["BARU", "DIPROSES", "SELESAI"] as const;
export type ComplaintSeverity = (typeof COMPLAINT_SEVERITIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface ComplaintInput {
  branchId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  channel?: string | null;
  category?: string | null;
  severity?: ComplaintSeverity;
  description: string;
}

function clean(value?: string | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function isSeverity(value: unknown): value is ComplaintSeverity {
  return typeof value === "string" && (COMPLAINT_SEVERITIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is ComplaintStatus {
  return typeof value === "string" && (COMPLAINT_STATUSES as readonly string[]).includes(value);
}

function normalize(input: ComplaintInput) {
  const description = input.description.trim();
  if (description.length < 5) throw new ValidationError("Deskripsi keluhan minimal 5 karakter.");
  const severity = input.severity ?? "SEDANG";
  if (!isSeverity(severity)) throw new ValidationError("Tingkat keluhan tidak valid.");
  return {
    branchId: input.branchId || null,
    customerId: input.customerId || null,
    orderId: input.orderId || null,
    channel: clean(input.channel),
    category: clean(input.category),
    severity,
    description,
  };
}

export async function listComplaints(filter: { branchId?: string | null; status?: string; severity?: string; q?: string } = {}) {
  const q = filter.q?.trim();
  const rows = await db
    .select({
      complaint: customerComplaints,
      customerName: customers.name,
      customerPhone: customers.phone,
      orderNumber: orders.orderNumber,
      branchName: branches.name,
    })
    .from(customerComplaints)
    .leftJoin(customers, eq(customerComplaints.customerId, customers.id))
    .leftJoin(orders, eq(customerComplaints.orderId, orders.id))
    .leftJoin(branches, eq(customerComplaints.branchId, branches.id))
    .where(
      and(
        filter.branchId ? eq(customerComplaints.branchId, filter.branchId) : undefined,
        isStatus(filter.status) ? eq(customerComplaints.status, filter.status) : undefined,
        isSeverity(filter.severity) ? eq(customerComplaints.severity, filter.severity) : undefined,
        q
          ? or(
              ilike(customerComplaints.description, `%${q}%`),
              ilike(customerComplaints.category, `%${q}%`),
              ilike(customers.name, `%${q}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(customerComplaints.receivedAt));

  return rows.map((r) => ({
    ...r.complaint,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    orderNumber: r.orderNumber,
    branchName: r.branchName,
  }));
}

export async function complaintSummary(branchId?: string | null) {
  const rows = await db
    .select({ status: customerComplaints.status, severity: customerComplaints.severity, n: sql<number>`count(*)::int` })
    .from(customerComplaints)
    .where(branchId ? eq(customerComplaints.branchId, branchId) : undefined)
    .groupBy(customerComplaints.status, customerComplaints.severity);

  const counts: Record<ComplaintStatus, number> = { BARU: 0, DIPROSES: 0, SELESAI: 0 };
  let tinggi = 0;
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n);
    total += n;
    counts[r.status] += n;
    if (r.severity === "TINGGI") tinggi += n;
  }
  return { total, ...counts, tinggi };
}



/** Hapus keluhan (bulk). */
export async function deleteComplaints(ids: string[], actor: AuthUser): Promise<{ error?: string }> {
  const rows = await db.select().from(customerComplaints).where(inArray(customerComplaints.id, ids));
  await db.delete(customerComplaints).where(inArray(customerComplaints.id, ids));
  for (const r of rows) {
    await insertAudit(db, { actor, action: "DELETE", module: "crm", entityType: "complaint", entityId: r.id, before: r });
  }
  return {};
}

export async function createComplaint(input: ComplaintInput, actor: AuthUser): Promise<string> {
  const data = normalize(input);
  const branchId = data.branchId ?? actor.branchId ?? null;
  if (!branchId) throw new ValidationError("Cabang wajib dipilih untuk keluhan baru.");
  const [row] = await db
    .insert(customerComplaints)
    .values({ ...data, branchId })
    .returning({ id: customerComplaints.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "crm",
    entityType: "complaint",
    entityId: row.id,
    after: data,
  });
  return row.id;
}

export async function setComplaintStatus(
  id: string,
  status: ComplaintStatus,
  resolution: string | null,
  actor: AuthUser
): Promise<void> {
  if (!isStatus(status)) throw new ValidationError("Status keluhan tidak valid.");
  const [before] = await db.select().from(customerComplaints).where(eq(customerComplaints.id, id)).limit(1);
  if (!before) throw new NotFoundError("Keluhan tidak ditemukan.");
  const resolvedAt = status === "SELESAI" ? new Date() : null;
  await db
    .update(customerComplaints)
    .set({ status, resolution: clean(resolution), resolvedAt })
    .where(eq(customerComplaints.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "crm",
    entityType: "complaint",
    entityId: id,
    before: { status: before.status, resolution: before.resolution },
    after: { status, resolution: clean(resolution) },
  });
}
