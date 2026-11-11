import "server-only";
import { and, asc, count, desc, eq, getTableColumns, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { customers, leadFollowups, leads } from "@/db/schema/crm";
import { users } from "@/db/schema/core";
import {
  canTransitionLead,
  isLeadClosed,
  leadStageIndex,
  type LeadDueFilter,
  type LeadStage,
} from "@/lib/crm/pipeline";
import { ConflictError, InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import { followupCreateSchema, leadCreateSchema, leadUpdateSchema, type LeadCreateInput } from "@/server/schemas";

export { canTransitionLead };

export interface LeadFilters {
  branchId?: string;
  status?: LeadStage | "ALL";
  source?: string;
  ownerId?: string | "UNASSIGNED";
  due?: LeadDueFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CrmSummary {
  total: number;
  open: number;
  closed: number;
  unassigned: number;
  newLeads: number;
  pipelineValue: number;
  dueToday: number;
  overdue: number;
  conversion: number | null;
}

export interface LeadListRow {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  company: string | null;
  source: string;
  status: LeadStage;
  productInterest: string | null;
  budget: bigint | null;
  notes: string | null;
  assignedTo: string | null;
  ownerName: string | null;
  nextFollowupAt: Date | null;
  nextFollowupDue: Date | null;
  openFollowups: number;
  updatedAt: Date;
}

function nextDueSubquery() {
  return sql<Date | null>`(
    select min(f.due_at)
    from lead_followups f
    where f.lead_id = ${leads.id} and f.status = 'PLANNED'
  )`.as("next_followup_due");
}

function openFollowupsSubquery() {
  return sql<number>`(
    select count(*)::int
    from lead_followups f
    where f.lead_id = ${leads.id} and f.status = 'PLANNED'
  )`
    .mapWith(Number)
    .as("open_followups");
}

export async function createLead(input: LeadCreateInput, actor: AuthUser): Promise<string> {
  const parsed = leadCreateSchema.parse(input);
  const branchId = parsed.branchId ?? actor.branchId;
  if (!branchId) throw new ConflictError("Branch belum diatur untuk user.");

  const [row] = await db
    .insert(leads)
    .values({
      branchId,
      customerId: parsed.customerId ?? null,
      source: parsed.source,
      name: parsed.name,
      phone: parsed.phone ?? null,
      whatsapp: parsed.whatsapp ?? null,
      email: parsed.email || null,
      company: parsed.company ?? null,
      city: parsed.city ?? null,
      address: parsed.address ?? null,
      productInterest: parsed.productInterest ?? null,
      budget: parsed.budget,
      notes: parsed.notes ?? null,
      assignedTo: parsed.assignedTo ?? null,
      nextFollowupAt: parsed.nextFollowupAt,
      firstContactAt: new Date(),
      createdBy: actor.id,
    })
    .returning({ id: leads.id });

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "crm",
    entityType: "lead",
    entityId: row.id,
    after: { name: parsed.name, status: "LEAD", source: parsed.source },
  });
  return row.id;
}

/**
 * Update parsial: hanya kolom yang dikirim yang diubah. Versi lama menulis
 * `null` ke semua kolom yang tidak dikirim sehingga telepon/email dapat
 * terhapus saat hanya memperbarui catatan.
 */
export async function updateLead(
  id: string,
  input: Partial<Omit<LeadCreateInput, "assignedTo" | "nextFollowupAt">> & {
    assignedTo?: string | null;
    nextFollowupAt?: Date | null;
  },
  actor: AuthUser
): Promise<string> {
  const parsed = leadUpdateSchema.parse(input);
  const before = await requireLead(id);

  const patch: Partial<typeof leads.$inferInsert> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.phone !== undefined) patch.phone = parsed.phone || null;
  if (parsed.whatsapp !== undefined) patch.whatsapp = parsed.whatsapp || null;
  if (parsed.email !== undefined) patch.email = parsed.email || null;
  if (parsed.company !== undefined) patch.company = parsed.company || null;
  if (parsed.city !== undefined) patch.city = parsed.city || null;
  if (parsed.address !== undefined) patch.address = parsed.address || null;
  if (parsed.productInterest !== undefined) patch.productInterest = parsed.productInterest || null;
  if (parsed.budget !== undefined) patch.budget = parsed.budget;
  if (parsed.notes !== undefined) patch.notes = parsed.notes || null;
  if (parsed.source !== undefined) patch.source = parsed.source;
  if (parsed.assignedTo !== undefined) patch.assignedTo = parsed.assignedTo || null;
  if (parsed.nextFollowupAt !== undefined) patch.nextFollowupAt = parsed.nextFollowupAt;

  if (Object.keys(patch).length > 0) {
    await db.update(leads).set(patch).where(eq(leads.id, id));
  }

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "crm",
    entityType: "lead",
    entityId: id,
    before: { name: before.name, phone: before.phone, owner: before.assignedTo },
    after: { name: parsed.name ?? before.name, fields: Object.keys(patch) },
  });
  return id;
}

export async function assignLead(
  id: string,
  assignedTo: string | null,
  actor: AuthUser
): Promise<string> {
  const before = await requireLead(id);
  await db.update(leads).set({ assignedTo }).where(eq(leads.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "crm",
    entityType: "lead",
    entityId: id,
    before: { owner: before.assignedTo },
    after: { owner: assignedTo },
  });
  return id;
}

/** Transisi status CRM (state machine). */
export async function transitionLead(
  id: string,
  to: LeadStage,
  actor: AuthUser,
  closedReason?: string
): Promise<LeadStage> {
  const lead = await requireLead(id);
  if (!canTransitionLead(lead.status, to)) {
    throw new InvalidOperationError(`Transisi ${lead.status} → ${to} tidak diizinkan.`);
  }

  const closing = isLeadClosed(to);
  const reason = closing ? closedReason?.trim() || null : null;
  await db
    .update(leads)
    .set({
      status: to,
      closedAt: closing ? new Date() : null,
      closedReason: reason,
    })
    .where(eq(leads.id, id));

  await insertAudit(db, {
    actor,
    action: "TRANSITION",
    module: "crm",
    entityType: "lead",
    entityId: id,
    before: { status: lead.status, order: leadStageIndex(lead.status) },
    after: { status: to, order: leadStageIndex(to), reason },
  });
  return to;
}

export async function addFollowup(
  input: {
    leadId: string;
    agentId?: string;
    method: "WA" | "CALL" | "MEETING" | "EMAIL";
    summary?: string;
    dueAt?: Date;
  },
  actor: AuthUser
): Promise<string> {
  const parsed = followupCreateSchema.parse(input);
  const lead = await requireLead(parsed.leadId);

  const [row] = await db
    .insert(leadFollowups)
    .values({
      leadId: parsed.leadId,
      agentId: parsed.agentId ?? actor.id,
      method: parsed.method,
      summary: parsed.summary ?? null,
      dueAt: parsed.dueAt,
    })
    .returning({ id: leadFollowups.id });

  if (parsed.dueAt && (!lead.nextFollowupAt || parsed.dueAt < lead.nextFollowupAt)) {
    await db.update(leads).set({ nextFollowupAt: parsed.dueAt }).where(eq(leads.id, parsed.leadId));
  }

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "crm",
    entityType: "lead_followup",
    entityId: row.id,
    after: { leadId: parsed.leadId, method: parsed.method, dueAt: parsed.dueAt?.toISOString() },
  });
  return row.id;
}

async function syncNextFollowup(leadId: string): Promise<void> {
  const [next] = await db
    .select({ dueAt: leadFollowups.dueAt })
    .from(leadFollowups)
    .where(
      and(
        eq(leadFollowups.leadId, leadId),
        eq(leadFollowups.status, "PLANNED"),
        sql`${leadFollowups.dueAt} is not null`
      )
    )
    .orderBy(asc(leadFollowups.dueAt))
    .limit(1);
  await db.update(leads).set({ nextFollowupAt: next?.dueAt ?? null }).where(eq(leads.id, leadId));
}

async function requireFollowup(followupId: string) {
  const [row] = await db.select().from(leadFollowups).where(eq(leadFollowups.id, followupId)).limit(1);
  if (!row) throw new NotFoundError("Follow-up tidak ditemukan.");
  return row;
}

export async function markFollowupDone(followupId: string, actor: AuthUser): Promise<string> {
  const followup = await requireFollowup(followupId);
  await db
    .update(leadFollowups)
    .set({ status: "DONE", completedAt: new Date() })
    .where(eq(leadFollowups.id, followupId));
  await syncNextFollowup(followup.leadId);
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "crm",
    entityType: "lead_followup",
    entityId: followupId,
    after: { status: "DONE", leadId: followup.leadId },
  });
  return followupId;
}

export async function cancelFollowup(followupId: string, actor: AuthUser): Promise<string> {
  const followup = await requireFollowup(followupId);
  await db
    .update(leadFollowups)
    .set({ status: "CANCELLED" })
    .where(eq(leadFollowups.id, followupId));
  await syncNextFollowup(followup.leadId);
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "crm",
    entityType: "lead_followup",
    entityId: followupId,
    after: { status: "CANCELLED", leadId: followup.leadId },
  });
  return followupId;
}

/* --------------------------------- Listing -------------------------------- */

function leadWhere(filters: LeadFilters) {
  const conditions = [isNull(leads.deletedAt)];
  if (filters.branchId) conditions.push(eq(leads.branchId, filters.branchId));
  if (filters.status && filters.status !== "ALL") conditions.push(eq(leads.status, filters.status));
  if (filters.source && filters.source !== "ALL") {
    conditions.push(sql`${leads.source}::text = ${filters.source}`);
  }
  if (filters.ownerId === "UNASSIGNED") {
    conditions.push(isNull(leads.assignedTo));
  } else if (filters.ownerId) {
    conditions.push(eq(leads.assignedTo, filters.ownerId));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${leads.name} ilike ${term}`,
        sql`${leads.phone} ilike ${term}`,
        sql`${leads.whatsapp} ilike ${term}`,
        sql`${leads.email} ilike ${term}`,
        sql`${leads.company} ilike ${term}`
      )!
    );
  }

  switch (filters.due) {
    case "OVERDUE":
      conditions.push(
        sql`exists (select 1 from lead_followups f where f.lead_id = ${leads.id} and f.status = 'PLANNED' and f.due_at < now())`
      );
      break;
    case "TODAY":
      conditions.push(
        sql`exists (select 1 from lead_followups f where f.lead_id = ${leads.id} and f.status = 'PLANNED' and (f.due_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date)`
      );
      break;
    case "WEEK":
      conditions.push(
        sql`exists (select 1 from lead_followups f where f.lead_id = ${leads.id} and f.status = 'PLANNED' and f.due_at >= now() and f.due_at < now() + interval '7 days')`
      );
      break;
    case "NONE":
      conditions.push(
        sql`not exists (select 1 from lead_followups f where f.lead_id = ${leads.id} and f.status = 'PLANNED') and ${leads.nextFollowupAt} is null`
      );
      break;
    default:
      break;
  }

  return and(...conditions);
}

export async function listLeads(filters: LeadFilters = {}) {
  const { page = 1, pageSize = 200 } = filters;
  const where = leadWhere(filters);

  const rows = await db
    .select({
      ...getTableColumns(leads),
      ownerName: users.name,
      nextFollowupDue: nextDueSubquery(),
      openFollowups: openFollowupsSubquery(),
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(where)
    .orderBy(desc(leads.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db.select({ total: count() }).from(leads).where(where);
  return {
    rows: rows as LeadListRow[],
    total: Number(total),
    page,
    pageSize,
  };
}

export async function getCrmSummary(branchId?: string): Promise<CrmSummary> {
  const scope = and(isNull(leads.deletedAt), branchId ? eq(leads.branchId, branchId) : undefined);

  const [leadStats] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where ${leads.status} <> 'CLOSED')`.mapWith(Number),
      closed: sql<number>`count(*) filter (where ${leads.status} = 'CLOSED')`.mapWith(Number),
      unassigned: sql<number>`count(*) filter (where ${leads.assignedTo} is null)`.mapWith(Number),
      newLeads: sql<number>`count(*) filter (where ${leads.status} = 'LEAD')`.mapWith(Number),
      pipelineValue:
        sql<string>`coalesce(sum(${leads.budget}) filter (where ${leads.status} <> 'CLOSED'), 0)::text`.mapWith(
          String
        ),
    })
    .from(leads)
    .where(scope);

  const [followupStats] = await db
    .select({
      dueToday:
        sql<number>`count(*) filter (where (${leadFollowups.dueAt} at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date)`.mapWith(
          Number
        ),
      overdue: sql<number>`count(*) filter (where ${leadFollowups.dueAt} < now())`.mapWith(Number),
    })
    .from(leadFollowups)
    .innerJoin(leads, eq(leadFollowups.leadId, leads.id))
    .where(and(eq(leadFollowups.status, "PLANNED"), scope));

  const total = Number(leadStats.total);
  const closed = Number(leadStats.closed);

  return {
    total,
    open: Number(leadStats.open),
    closed,
    unassigned: Number(leadStats.unassigned),
    newLeads: Number(leadStats.newLeads),
    pipelineValue: Number(leadStats.pipelineValue ?? 0),
    dueToday: Number(followupStats?.dueToday ?? 0),
    overdue: Number(followupStats?.overdue ?? 0),
    conversion: total > 0 ? closed / total : null,
  };
}

export async function listLeadsByStatus(branchId?: string): Promise<Record<LeadStage, number>> {
  const rows = await db
    .select({ status: leads.status, count: count() })
    .from(leads)
    .where(and(isNull(leads.deletedAt), branchId ? eq(leads.branchId, branchId) : undefined))
    .groupBy(leads.status);
  const result = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) as Record<
    LeadStage,
    number
  >;
  for (const s of ["LEAD", "CONTACTED", "INTERESTED", "QUOTATION", "DP", "CLOSED"] as LeadStage[]) {
    if (!result[s]) result[s] = 0;
  }
  return result;
}

/* --------------------------------- Detail --------------------------------- */

export interface LeadActivity {
  id: string;
  action: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export async function getLeadDetail(id: string, opts: { branchId?: string } = {}) {
  const [lead] = await db
    .select({
      ...getTableColumns(leads),
      ownerName: users.name,
      customerName: customers.name,
      customerCode: customers.code,
      customerPhone: customers.phone,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) return null;
  if (opts.branchId && lead.branchId !== opts.branchId) return null;

  const [followups, activities] = await Promise.all([
    db
      .select({
        ...getTableColumns(leadFollowups),
        agentName: users.name,
      })
      .from(leadFollowups)
      .leftJoin(users, eq(leadFollowups.agentId, users.id))
      .where(eq(leadFollowups.leadId, id))
      .orderBy(desc(leadFollowups.createdAt))
      .limit(100),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorName: users.name,
        before: auditLogs.before,
        after: auditLogs.after,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(
        and(
          eq(auditLogs.module, "crm"),
          eq(auditLogs.entityType, "lead"),
          eq(auditLogs.entityId, id)
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  ]);

  return { lead, followups, activities };
}

export async function listLeadFollowups(leadId: string) {
  return db
    .select()
    .from(leadFollowups)
    .where(eq(leadFollowups.leadId, leadId))
    .orderBy(desc(leadFollowups.createdAt))
    .limit(100);
}

export async function listAssignableUsers(branchId?: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.isActive, true), branchId ? eq(users.branchId, branchId) : undefined))
    .orderBy(asc(users.name));
}

export async function requireLead(id: string) {
  const row = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Lead tidak ditemukan.");
  return row[0];
}
