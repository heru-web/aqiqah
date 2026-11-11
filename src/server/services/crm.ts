import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  branches,
  crmActivities,
  crmDeals,
  crmNotes,
  crmOrganizations,
  crmPeople,
  crmPipelines,
  crmStageHistory,
  crmStages,
  users,
} from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";
import { AppError } from "@/lib/errors";

export type CrmStageType = "OPEN" | "WON" | "LOST";
export type CrmActivityType = "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "TASK";

export interface CrmStage {
  id: string;
  pipelineId: string;
  name: string;
  description: string | null;
  color: string;
  type: CrmStageType;
  position: number;
}

export interface CrmDealRow {
  id: string;
  title: string;
  value: bigint;
  source: string | null;
  productInterest: string | null;
  stageId: string;
  stageName: string;
  stageType: CrmStageType;
  stageColor: string;
  personId: string | null;
  personName: string | null;
  personPhone: string | null;
  personWhatsapp: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  lostReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmDealFilters {
  branchId?: string;
  search?: string;
  stageId?: string;
  personId?: string;
  organizationId?: string;
  ownerId?: string;
  status?: "OPEN" | "WON" | "LOST" | "ALL";
  source?: string;
}

export interface CrmOverview {
  total: number;
  open: number;
  won: number;
  lost: number;
  pipelineValue: bigint;
  wonValue: bigint;
  dueActivities: number;
  conversion: number | null;
}

const DEFAULT_STAGES: Array<Omit<CrmStage, "id" | "pipelineId">> = [
  { name: "Lead Baru", description: "Prospek masuk, belum dihubungi.", color: "slate", type: "OPEN", position: 0 },
  { name: "Dihubungi", description: "Sudah ada kontak pertama.", color: "blue", type: "OPEN", position: 1 },
  { name: "Minat", description: "Tertarik, masih pertimbangan.", color: "amber", type: "OPEN", position: 2 },
  { name: "Penawaran", description: "Penawaran sudah dikirim.", color: "violet", type: "OPEN", position: 3 },
  { name: "DP Masuk", description: "Komitmen DP diterima.", color: "emerald", type: "OPEN", position: 4 },
  { name: "Jadi pesanan", description: "Prospek jadi pesanan — nilainya masuk rekap pesanan masuk.", color: "emerald", type: "WON", position: 5 },
  { name: "Batal", description: "Prospek berhenti / deal lost.", color: "rose", type: "LOST", position: 6 },
];

export async function ensureDefaultPipeline(branchId?: string | null): Promise<{
  pipelineId: string;
  stages: CrmStage[];
}> {
  const existing = await db
    .select()
    .from(crmPipelines)
    .where(and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)))
    .orderBy(asc(crmPipelines.createdAt))
    .limit(1);

  let pipeline = existing[0];
  if (!pipeline) {
    const inserted = await db
      .insert(crmPipelines)
      .values({
        branchId: branchId ?? null,
        name: "Pipeline Penjualan",
        isDefault: true,
      })
      .returning();
    pipeline = inserted[0];
  }

  let stages = await listStages(pipeline.id);
  if (stages.length === 0) {
    await db.insert(crmStages).values(
      DEFAULT_STAGES.map((stage) => ({
        ...stage,
        pipelineId: pipeline.id,
      }))
    );
    stages = await listStages(pipeline.id);
  }

  return { pipelineId: pipeline.id, stages };
}

export async function listStages(pipelineId: string): Promise<CrmStage[]> {
  const rows = await db
    .select()
    .from(crmStages)
    .where(eq(crmStages.pipelineId, pipelineId))
    .orderBy(asc(crmStages.position), asc(crmStages.createdAt));
  return rows as CrmStage[];
}

export async function listPipelines(): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  return db
    .select({ id: crmPipelines.id, name: crmPipelines.name, isDefault: crmPipelines.isDefault })
    .from(crmPipelines)
    .where(and(isNull(crmPipelines.deletedAt), eq(crmPipelines.isActive, true)))
    .orderBy(desc(crmPipelines.isDefault), asc(crmPipelines.name));
}

export async function listCrmUsers(branchId?: string | null): Promise<Array<{ id: string; name: string; email: string }>> {
  const where = branchId
    ? and(eq(users.isActive, true), isNull(users.deletedAt), eq(users.branchId, branchId))
    : and(eq(users.isActive, true), isNull(users.deletedAt));
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(where).orderBy(asc(users.name));
}

function dealFilters(filters: CrmDealFilters) {
  const conditions = [isNull(crmDeals.deletedAt)];
  if (filters.branchId) conditions.push(eq(crmDeals.branchId, filters.branchId));
  if (filters.stageId) conditions.push(eq(crmDeals.stageId, filters.stageId));
  if (filters.personId) conditions.push(eq(crmDeals.personId, filters.personId));
  if (filters.organizationId) conditions.push(eq(crmDeals.organizationId, filters.organizationId));
  if (filters.ownerId === "UNASSIGNED") conditions.push(isNull(crmDeals.ownerId));
  else if (filters.ownerId) conditions.push(eq(crmDeals.ownerId, filters.ownerId));
  if (filters.source) conditions.push(eq(crmDeals.source, filters.source));
  if (filters.status === "OPEN") conditions.push(eq(crmStages.type, "OPEN"));
  if (filters.status === "WON") conditions.push(eq(crmStages.type, "WON"));
  if (filters.status === "LOST") conditions.push(eq(crmStages.type, "LOST"));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(crmDeals.title, term),
        ilike(crmPeople.name, term),
        ilike(crmPeople.phone, term),
        ilike(crmPeople.email, term),
        ilike(crmOrganizations.name, term)
      )!
    );
  }
  return and(...conditions);
}

export async function listCrmDeals(filters: CrmDealFilters = {}): Promise<CrmDealRow[]> {
  const rows = await db
    .select({
      id: crmDeals.id,
      title: crmDeals.title,
      value: crmDeals.value,
      source: crmDeals.source,
      productInterest: crmDeals.productInterest,
      stageId: crmDeals.stageId,
      stageName: crmStages.name,
      stageType: crmStages.type,
      stageColor: crmStages.color,
      personId: crmDeals.personId,
      personName: crmPeople.name,
      personPhone: crmPeople.phone,
      personWhatsapp: crmPeople.whatsapp,
      organizationId: crmDeals.organizationId,
      organizationName: crmOrganizations.name,
      ownerId: crmDeals.ownerId,
      ownerName: users.name,
      expectedCloseDate: crmDeals.expectedCloseDate,
      closedAt: crmDeals.closedAt,
      lostReason: crmDeals.lostReason,
      notes: crmDeals.notes,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
    })
    .from(crmDeals)
    .innerJoin(crmStages, eq(crmDeals.stageId, crmStages.id))
    .leftJoin(crmPeople, eq(crmDeals.personId, crmPeople.id))
    .leftJoin(crmOrganizations, eq(crmDeals.organizationId, crmOrganizations.id))
    .leftJoin(users, eq(crmDeals.ownerId, users.id))
    .where(dealFilters(filters))
    .orderBy(asc(crmStages.position), desc(crmDeals.createdAt));

  return rows as CrmDealRow[];
}

export async function getCrmOverview(branchId?: string): Promise<CrmOverview> {
  const deals = await listCrmDeals({ branchId, status: "ALL" });
  const openDeals = deals.filter((d) => d.stageType === "OPEN");
  const wonDeals = deals.filter((d) => d.stageType === "WON");
  const lostDeals = deals.filter((d) => d.stageType === "LOST");
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0n);
  const wonValue = wonDeals.reduce((sum, d) => sum + d.value, 0n);
  const closed = wonDeals.length + lostDeals.length;

  const dueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmActivities)
    .where(
      and(
        isNull(crmActivities.deletedAt),
        isNull(crmActivities.completedAt),
        lt(crmActivities.dueAt, new Date()),
        branchId ? eq(crmActivities.branchId, branchId) : sql`true`
      )
    );

  return {
    total: deals.length,
    open: openDeals.length,
    won: wonDeals.length,
    lost: lostDeals.length,
    pipelineValue,
    wonValue,
    dueActivities: Number(dueRows[0]?.count ?? 0),
    conversion: closed > 0 ? wonDeals.length / closed : null,
  };
}

export interface CrmDealInput {
  title: string;
  value?: bigint;
  stageId: string;
  personId?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
  source?: string | null;
  productInterest?: string | null;
  expectedCloseDate?: Date | null;
  notes?: string | null;
}

async function getStageOrThrow(stageId: string): Promise<{ stage: CrmStage; pipelineId: string }> {
  const rows = await db.select().from(crmStages).where(eq(crmStages.id, stageId)).limit(1);
  if (rows.length === 0) throw new AppError("VALIDATION_ERROR", "Tahap pipeline tidak ditemukan.");
  return { stage: rows[0] as CrmStage, pipelineId: rows[0].pipelineId };
}

export async function createCrmDeal(input: CrmDealInput, actor: AuthUser): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new AppError("VALIDATION_ERROR", "Judul deal wajib diisi.");
  const { stage } = await getStageOrThrow(input.stageId);

  const maxPosition = await db
    .select({ max: sql<number>`coalesce(max(${crmDeals.position}), 0)::int` })
    .from(crmDeals)
    .where(and(eq(crmDeals.stageId, input.stageId), isNull(crmDeals.deletedAt)));

  const inserted = await db
    .insert(crmDeals)
    .values({
      branchId: actor.branchId ?? null,
      pipelineId: stage.pipelineId,
      stageId: input.stageId,
      title,
      value: input.value ?? 0n,
      source: input.source ?? null,
      productInterest: input.productInterest ?? null,
      personId: input.personId ?? null,
      organizationId: input.organizationId ?? null,
      ownerId: input.ownerId ?? actor.id,
      expectedCloseDate: input.expectedCloseDate ?? null,
      notes: input.notes ?? null,
      position: Number(maxPosition[0]?.max ?? 0) + 1,
      closedAt: stage.type === "OPEN" ? null : new Date(),
    })
    .returning({ id: crmDeals.id });

  const id = inserted[0].id;
  await db.insert(crmStageHistory).values({
    dealId: id,
    toStageId: input.stageId,
    changedBy: actor.id,
    reason: "Deal dibuat",
  });
  return id;
}

export async function updateCrmDeal(
  id: string,
  input: Partial<CrmDealInput> & { lostReason?: string | null },
  actor: AuthUser
): Promise<void> {
  const existing = await db
    .select()
    .from(crmDeals)
    .where(and(eq(crmDeals.id, id), isNull(crmDeals.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Deal tidak ditemukan.");

  const current = existing[0];
  let stageType: CrmStageType | null = null;
  const nextStageId = input.stageId ?? current.stageId;
  if (input.stageId && input.stageId !== current.stageId) {
    const { stage } = await getStageOrThrow(input.stageId);
    stageType = stage.type;
  }

  await db
    .update(crmDeals)
    .set({
      title: input.title?.trim() || current.title,
      value: input.value ?? current.value,
      stageId: nextStageId,
      personId: input.personId !== undefined ? input.personId : current.personId,
      organizationId: input.organizationId !== undefined ? input.organizationId : current.organizationId,
      ownerId: input.ownerId !== undefined ? input.ownerId : current.ownerId,
      source: input.source !== undefined ? input.source : current.source,
      productInterest: input.productInterest !== undefined ? input.productInterest : current.productInterest,
      expectedCloseDate:
        input.expectedCloseDate !== undefined ? input.expectedCloseDate : current.expectedCloseDate,
      notes: input.notes !== undefined ? input.notes : current.notes,
      lostReason: input.lostReason !== undefined ? input.lostReason : current.lostReason,
      closedAt:
        stageType === null
          ? current.closedAt
          : stageType === "OPEN"
            ? null
            : (current.closedAt ?? new Date()),
      updatedAt: new Date(),
    })
    .where(eq(crmDeals.id, id));

  if (nextStageId !== current.stageId) {
    await db.insert(crmStageHistory).values({
      dealId: id,
      fromStageId: current.stageId,
      toStageId: nextStageId,
      changedBy: actor.id,
      reason: input.lostReason ?? null,
    });
  }
}

export async function moveCrmDeal(id: string, stageId: string, actor: AuthUser, reason?: string): Promise<void> {
  const existing = await db
    .select()
    .from(crmDeals)
    .where(and(eq(crmDeals.id, id), isNull(crmDeals.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Deal tidak ditemukan.");
  if (existing[0].stageId === stageId) return;

  const { stage } = await getStageOrThrow(stageId);
  const maxPosition = await db
    .select({ max: sql<number>`coalesce(max(${crmDeals.position}), 0)::int` })
    .from(crmDeals)
    .where(and(eq(crmDeals.stageId, stageId), isNull(crmDeals.deletedAt)));

  await db
    .update(crmDeals)
    .set({
      stageId,
      position: Number(maxPosition[0]?.max ?? 0) + 1,
      closedAt: stage.type === "OPEN" ? null : (existing[0].closedAt ?? new Date()),
      lostReason: stage.type === "LOST" ? (reason ?? existing[0].lostReason) : null,
      updatedAt: new Date(),
    })
    .where(eq(crmDeals.id, id));

  await db.insert(crmStageHistory).values({
    dealId: id,
    fromStageId: existing[0].stageId,
    toStageId: stageId,
    changedBy: actor.id,
    reason: reason ?? null,
  });
}

export async function deleteCrmDeal(id: string, actor: AuthUser): Promise<void> {
  const existing = await db
    .select({ id: crmDeals.id })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, id), isNull(crmDeals.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Deal tidak ditemukan.");
  const now = new Date();
  await db
    .update(crmDeals)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(crmDeals.id, id));
  await db
    .update(crmActivities)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(crmActivities.dealId, id), isNull(crmActivities.deletedAt)));
  await db.insert(crmNotes).values({
    dealId: id,
    body: `Deal dihapus oleh ${actor.name}.`,
    authorId: actor.id,
  });
}

export async function getCrmDealDetail(id: string, branchId?: string) {
  const conditions = [eq(crmDeals.id, id), isNull(crmDeals.deletedAt)];
  if (branchId) conditions.push(eq(crmDeals.branchId, branchId));

  const rows = await db
    .select({
      deal: crmDeals,
      stage: crmStages,
      person: crmPeople,
      organization: crmOrganizations,
      ownerName: users.name,
    })
    .from(crmDeals)
    .innerJoin(crmStages, eq(crmDeals.stageId, crmStages.id))
    .leftJoin(crmPeople, eq(crmDeals.personId, crmPeople.id))
    .leftJoin(crmOrganizations, eq(crmDeals.organizationId, crmOrganizations.id))
    .leftJoin(users, eq(crmDeals.ownerId, users.id))
    .where(and(...conditions))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  const activities = await db
    .select({ activity: crmActivities, ownerName: users.name })
    .from(crmActivities)
    .leftJoin(users, eq(crmActivities.ownerId, users.id))
    .where(and(eq(crmActivities.dealId, id), isNull(crmActivities.deletedAt)))
    .orderBy(desc(crmActivities.dueAt), desc(crmActivities.createdAt));

  const notes = await db
    .select({ note: crmNotes, authorName: users.name })
    .from(crmNotes)
    .leftJoin(users, eq(crmNotes.authorId, users.id))
    .where(and(eq(crmNotes.dealId, id), isNull(crmNotes.deletedAt)))
    .orderBy(desc(crmNotes.createdAt));

  const history = await db
    .select({
      id: crmStageHistory.id,
      createdAt: crmStageHistory.createdAt,
      reason: crmStageHistory.reason,
      fromName: crmStages.name,
      changedByName: users.name,
    })
    .from(crmStageHistory)
    .leftJoin(crmStages, eq(crmStageHistory.fromStageId, crmStages.id))
    .leftJoin(users, eq(crmStageHistory.changedBy, users.id))
    .where(eq(crmStageHistory.dealId, id))
    .orderBy(desc(crmStageHistory.createdAt));

  return {
    ...row.deal,
    profileNotes: row.deal.notes,
    stage: row.stage as CrmStage,
    person: row.person,
    organization: row.organization,
    ownerName: row.ownerName,
    activities: activities.map((r) => ({ ...r.activity, ownerName: r.ownerName })),
    notes: notes.map((r) => ({ ...r.note, authorName: r.authorName })),
    history,
  };
}

/* --------------------------------- Kontak --------------------------------- */

export interface CrmPersonRow {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  jobTitle: string | null;
  city: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  dealCount: number;
  openValue: bigint;
  createdAt: Date;
}

export async function listCrmPeople(filters: { branchId?: string; search?: string } = {}) {
  const conditions = [isNull(crmPeople.deletedAt)];
  if (filters.branchId) conditions.push(eq(crmPeople.branchId, filters.branchId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(crmPeople.name, term),
        ilike(crmPeople.phone, term),
        ilike(crmPeople.email, term),
        ilike(crmPeople.city, term)
      )!
    );
  }

  const dealCount = sql<number>`(select count(*)::int from ${crmDeals} where ${crmDeals.personId} = ${crmPeople.id} and ${crmDeals.deletedAt} is null)`;
  const openValue = sql<bigint>`(select coalesce(sum(${crmDeals.value}), 0)::bigint from ${crmDeals} inner join ${crmStages} on ${crmDeals.stageId} = ${crmStages.id} where ${crmDeals.personId} = ${crmPeople.id} and ${crmDeals.deletedAt} is null and ${crmStages.type} = 'OPEN')`;

  const rows = await db
    .select({
      id: crmPeople.id,
      name: crmPeople.name,
      phone: crmPeople.phone,
      whatsapp: crmPeople.whatsapp,
      email: crmPeople.email,
      jobTitle: crmPeople.jobTitle,
      city: crmPeople.city,
      organizationId: crmPeople.organizationId,
      organizationName: crmOrganizations.name,
      ownerId: crmPeople.ownerId,
      ownerName: users.name,
      dealCount,
      openValue,
      createdAt: crmPeople.createdAt,
    })
    .from(crmPeople)
    .leftJoin(crmOrganizations, eq(crmPeople.organizationId, crmOrganizations.id))
    .leftJoin(users, eq(crmPeople.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(asc(crmPeople.name));

  return rows as CrmPersonRow[];
}

export interface CrmOrganizationRow {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  ownerId: string | null;
  ownerName: string | null;
  peopleCount: number;
  dealCount: number;
  openValue: bigint;
}

export async function listCrmOrganizations(filters: { branchId?: string; search?: string } = {}) {
  const conditions = [isNull(crmOrganizations.deletedAt)];
  if (filters.branchId) conditions.push(eq(crmOrganizations.branchId, filters.branchId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(crmOrganizations.name, term), ilike(crmOrganizations.city, term))!);
  }

  const peopleCount = sql<number>`(select count(*)::int from ${crmPeople} where ${crmPeople.organizationId} = ${crmOrganizations.id} and ${crmPeople.deletedAt} is null)`;
  const dealCount = sql<number>`(select count(*)::int from ${crmDeals} where ${crmDeals.organizationId} = ${crmOrganizations.id} and ${crmDeals.deletedAt} is null)`;
  const openValue = sql<bigint>`(select coalesce(sum(${crmDeals.value}), 0)::bigint from ${crmDeals} inner join ${crmStages} on ${crmDeals.stageId} = ${crmStages.id} where ${crmDeals.organizationId} = ${crmOrganizations.id} and ${crmDeals.deletedAt} is null and ${crmStages.type} = 'OPEN')`;

  const rows = await db
    .select({
      id: crmOrganizations.id,
      name: crmOrganizations.name,
      industry: crmOrganizations.industry,
      phone: crmOrganizations.phone,
      email: crmOrganizations.email,
      city: crmOrganizations.city,
      ownerId: crmOrganizations.ownerId,
      ownerName: users.name,
      peopleCount,
      dealCount,
      openValue,
    })
    .from(crmOrganizations)
    .leftJoin(users, eq(crmOrganizations.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(asc(crmOrganizations.name));

  return rows as CrmOrganizationRow[];
}

export interface CrmDuplicateInfo {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

function normalizeContactValue(value?: string | null): string {
  return (value ?? "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

export async function findDuplicatePerson(input: {
  branchId?: string | null;
  organizationId?: string | null;
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  excludeId?: string | null;
}): Promise<CrmDuplicateInfo | null> {
  const conditions = [isNull(crmPeople.deletedAt)];
  if (input.branchId) conditions.push(eq(crmPeople.branchId, input.branchId));
  else conditions.push(isNull(crmPeople.branchId));
  if (input.organizationId) conditions.push(eq(crmPeople.organizationId, input.organizationId));
  const rows = await db
    .select({
      id: crmPeople.id,
      name: crmPeople.name,
      phone: crmPeople.phone,
      whatsapp: crmPeople.whatsapp,
      email: crmPeople.email,
      organizationId: crmPeople.organizationId,
      organizationName: crmOrganizations.name,
    })
    .from(crmPeople)
    .leftJoin(crmOrganizations, eq(crmPeople.organizationId, crmOrganizations.id))
    .where(and(...conditions));

  const targetPhone = normalizeContactValue(input.phone);
  const targetWhatsapp = normalizeContactValue(input.whatsapp);
  const targetEmail = normalizeContactValue(input.email);
  const hasContactSignal = Boolean(targetPhone || targetWhatsapp);
  const hasEmailSignal = Boolean(targetEmail);

  for (const row of rows) {
    const rowPhone = normalizeContactValue(row.phone);
    const rowWhatsapp = normalizeContactValue(row.whatsapp);
    const rowEmail = normalizeContactValue(row.email);
    const sameContact = hasContactSignal && ((targetPhone && rowPhone === targetPhone) || (targetWhatsapp && rowWhatsapp === targetWhatsapp));
    const sameEmail = hasEmailSignal && rowEmail === targetEmail;
    if (!sameContact && !sameEmail) continue;
    if (input.excludeId && row.id === input.excludeId) continue;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.email,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
    };
  }
  return null;
}

export async function findDuplicateOrganization(input: {
  branchId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  excludeId?: string | null;
}): Promise<CrmDuplicateInfo | null> {
  const conditions = [isNull(crmOrganizations.deletedAt)];
  if (input.branchId) conditions.push(eq(crmOrganizations.branchId, input.branchId));
  else conditions.push(isNull(crmOrganizations.branchId));
  const rows = await db
    .select({
      id: crmOrganizations.id,
      name: crmOrganizations.name,
      phone: crmOrganizations.phone,
      email: crmOrganizations.email,
    })
    .from(crmOrganizations)
    .where(and(...conditions));

  const targetPhone = normalizeContactValue(input.phone);
  const targetEmail = normalizeContactValue(input.email);
  const targetName = (input.name ?? "").trim().toLowerCase();
  for (const row of rows) {
    const rowPhone = normalizeContactValue(row.phone);
    const rowEmail = normalizeContactValue(row.email);
    const sameContact = Boolean(targetPhone) && rowPhone === targetPhone;
    const sameEmail = Boolean(targetEmail) && rowEmail === targetEmail;
    const sameName = Boolean(targetName) && row.name.trim().toLowerCase() === targetName;
    if (!sameContact && !sameEmail && !sameName) continue;
    if (input.excludeId && row.id === input.excludeId) continue;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      whatsapp: row.phone,
      email: row.email,
      organizationId: null,
      organizationName: row.name,
    };
  }
  return null;
}

export interface CrmPersonInput {
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}

export async function createCrmPerson(input: CrmPersonInput, actor: AuthUser): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new AppError("VALIDATION_ERROR", "Nama kontak wajib diisi.");
  const duplicate = await findDuplicatePerson({
    branchId: actor.branchId,
    organizationId: input.organizationId,
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
  });
  if (duplicate) {
    throw new AppError(
      "CONFLICT",
      `Ada kontak serupa: ${duplicate.name}. Nomor atau WhatsApp sudah terhubung dengan kontak lain.`,
      { details: { duplicate } }
    );
  }
  const inserted = await db
    .insert(crmPeople)
    .values({
      branchId: actor.branchId ?? null,
      organizationId: input.organizationId ?? null,
      name,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      jobTitle: input.jobTitle ?? null,
      city: input.city ?? null,
      ownerId: input.ownerId ?? actor.id,
      notes: input.notes ?? null,
    })
    .returning({ id: crmPeople.id });
  return inserted[0].id;
}

export async function updateCrmPerson(
  id: string,
  input: Partial<CrmPersonInput>,
  _actor: AuthUser
): Promise<void> {
  const existing = await db
    .select()
    .from(crmPeople)
    .where(and(eq(crmPeople.id, id), isNull(crmPeople.deletedAt)))
      .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Kontak tidak ditemukan.");
  const duplicate = await findDuplicatePerson({
    branchId: _actor.branchId,
    organizationId: input.organizationId ?? existing[0].organizationId,
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    excludeId: id,
  });
  if (duplicate) {
    throw new AppError(
      "CONFLICT",
      `Ada kontak serupa: ${duplicate.name}. Nomor atau WhatsApp sudah dipakai kontak lain.`,
      { details: { duplicate } }
    );
  }
  await db
    .update(crmPeople)
    .set({
      name: input.name?.trim() || existing[0].name,
      phone: input.phone !== undefined ? input.phone : existing[0].phone,
      whatsapp: input.whatsapp !== undefined ? input.whatsapp : existing[0].whatsapp,
      email: input.email !== undefined ? input.email : existing[0].email,
      jobTitle: input.jobTitle !== undefined ? input.jobTitle : existing[0].jobTitle,
      city: input.city !== undefined ? input.city : existing[0].city,
      organizationId: input.organizationId !== undefined ? input.organizationId : existing[0].organizationId,
      ownerId: input.ownerId !== undefined ? input.ownerId : existing[0].ownerId,
      notes: input.notes !== undefined ? input.notes : existing[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(crmPeople.id, id));
}

export async function deleteCrmPerson(id: string): Promise<void> {
  const existing = await db
    .select({ id: crmPeople.id })
    .from(crmPeople)
    .where(and(eq(crmPeople.id, id), isNull(crmPeople.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Kontak tidak ditemukan.");
  const now = new Date();
  await db.update(crmPeople).set({ deletedAt: now, updatedAt: now }).where(eq(crmPeople.id, id));
  await db
    .update(crmActivities)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(crmActivities.personId, id), isNull(crmActivities.deletedAt)));
  await db
    .update(crmDeals)
    .set({ personId: null, updatedAt: now })
    .where(and(eq(crmDeals.personId, id), isNull(crmDeals.deletedAt)));
}

export interface CrmOrganizationInput {
  name: string;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}

export async function createCrmOrganization(
  input: CrmOrganizationInput,
  actor: AuthUser
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new AppError("VALIDATION_ERROR", "Nama perusahaan wajib diisi.");
  const duplicate = await findDuplicateOrganization({
    branchId: actor.branchId,
    name: input.name,
    phone: input.phone,
    email: input.email,
  });
  if (duplicate) {
    throw new AppError(
      "CONFLICT",
      `Ada perusahaan serupa: ${duplicate.name}. Nama atau nomor sudah terhubung dengan data lain.`,
      { details: { duplicate } }
    );
  }
  const inserted = await db
    .insert(crmOrganizations)
    .values({
      branchId: actor.branchId ?? null,
      name,
      industry: input.industry ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      ownerId: input.ownerId ?? actor.id,
      notes: input.notes ?? null,
    })
    .returning({ id: crmOrganizations.id });
  return inserted[0].id;
}

export async function updateCrmOrganization(
  id: string,
  input: Partial<CrmOrganizationInput>,
  _actor: AuthUser
): Promise<void> {
  const existing = await db
    .select()
    .from(crmOrganizations)
    .where(and(eq(crmOrganizations.id, id), isNull(crmOrganizations.deletedAt)))
      .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Perusahaan tidak ditemukan.");
  const duplicate = await findDuplicateOrganization({
    branchId: _actor.branchId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    excludeId: id,
  });
  if (duplicate) {
    throw new AppError(
      "CONFLICT",
      `Ada perusahaan serupa: ${duplicate.name}. Nama atau nomor sudah dipakai data lain.`,
      { details: { duplicate } }
    );
  }
  await db
    .update(crmOrganizations)
    .set({
      name: input.name?.trim() || existing[0].name,
      industry: input.industry !== undefined ? input.industry : existing[0].industry,
      phone: input.phone !== undefined ? input.phone : existing[0].phone,
      email: input.email !== undefined ? input.email : existing[0].email,
      city: input.city !== undefined ? input.city : existing[0].city,
      address: input.address !== undefined ? input.address : existing[0].address,
      ownerId: input.ownerId !== undefined ? input.ownerId : existing[0].ownerId,
      notes: input.notes !== undefined ? input.notes : existing[0].notes,
      updatedAt: new Date(),
    })
    .where(eq(crmOrganizations.id, id));
}

export async function deleteCrmOrganization(id: string): Promise<void> {
  const existing = await db
    .select({ id: crmOrganizations.id })
    .from(crmOrganizations)
    .where(and(eq(crmOrganizations.id, id), isNull(crmOrganizations.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Perusahaan tidak ditemukan.");
  const now = new Date();
  await db.update(crmOrganizations).set({ deletedAt: now, updatedAt: now }).where(eq(crmOrganizations.id, id));
  await db
    .update(crmActivities)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(crmActivities.organizationId, id), isNull(crmActivities.deletedAt)));
  await db
    .update(crmPeople)
    .set({ organizationId: null, updatedAt: now })
    .where(and(eq(crmPeople.organizationId, id), isNull(crmPeople.deletedAt)));
  await db
    .update(crmDeals)
    .set({ organizationId: null, updatedAt: now })
    .where(and(eq(crmDeals.organizationId, id), isNull(crmDeals.deletedAt)));
}

export async function getCrmPersonDetail(id: string) {
  const rows = await db
    .select({
      person: crmPeople,
      organizationName: crmOrganizations.name,
      ownerName: users.name,
    })
    .from(crmPeople)
    .leftJoin(crmOrganizations, eq(crmPeople.organizationId, crmOrganizations.id))
    .leftJoin(users, eq(crmPeople.ownerId, users.id))
    .where(and(eq(crmPeople.id, id), isNull(crmPeople.deletedAt)))
    .limit(1);
  if (rows.length === 0) return null;

  const deals = await listCrmDeals({ personId: id, status: "ALL" });
  const activities = await db
    .select({ activity: crmActivities, ownerName: users.name })
    .from(crmActivities)
    .leftJoin(users, eq(crmActivities.ownerId, users.id))
    .where(and(eq(crmActivities.personId, id), isNull(crmActivities.deletedAt)))
    .orderBy(desc(crmActivities.dueAt));
  const notes = await db
    .select({ note: crmNotes, authorName: users.name })
    .from(crmNotes)
    .leftJoin(users, eq(crmNotes.authorId, users.id))
    .where(and(eq(crmNotes.personId, id), isNull(crmNotes.deletedAt)))
    .orderBy(desc(crmNotes.createdAt));

  return {
    ...rows[0].person,
    profileNotes: rows[0].person.notes,
    organizationName: rows[0].organizationName,
    ownerName: rows[0].ownerName,
    deals,
    activities: activities.map((r) => ({ ...r.activity, ownerName: r.ownerName })),
    notes: notes.map((r) => ({ ...r.note, authorName: r.authorName })),
  };
}

export async function getCrmOrganizationDetail(id: string) {
  const rows = await db
    .select({ organization: crmOrganizations, ownerName: users.name })
    .from(crmOrganizations)
    .leftJoin(users, eq(crmOrganizations.ownerId, users.id))
    .where(and(eq(crmOrganizations.id, id), isNull(crmOrganizations.deletedAt)))
    .limit(1);
  if (rows.length === 0) return null;

  const people = await listCrmPeople({});
  const deals = await listCrmDeals({ organizationId: id, status: "ALL" });
  const activities = await db
    .select({ activity: crmActivities, ownerName: users.name })
    .from(crmActivities)
    .leftJoin(users, eq(crmActivities.ownerId, users.id))
    .where(and(eq(crmActivities.organizationId, id), isNull(crmActivities.deletedAt)))
    .orderBy(desc(crmActivities.dueAt));
  const notes = await db
    .select({ note: crmNotes, authorName: users.name })
    .from(crmNotes)
    .leftJoin(users, eq(crmNotes.authorId, users.id))
    .where(and(eq(crmNotes.organizationId, id), isNull(crmNotes.deletedAt)))
    .orderBy(desc(crmNotes.createdAt));

  return {
    ...rows[0].organization,
    profileNotes: rows[0].organization.notes,
    ownerName: rows[0].ownerName,
    people: people.filter((p) => p.organizationId === id),
    deals,
    activities: activities.map((r) => ({ ...r.activity, ownerName: r.ownerName })),
    notes: notes.map((r) => ({ ...r.note, authorName: r.authorName })),
  };
}

/* -------------------------------- Aktivitas ------------------------------- */

export interface CrmActivityInput {
  dealId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  type: CrmActivityType;
  title: string;
  notes?: string | null;
  dueAt?: Date | null;
  ownerId?: string | null;
}

export async function listCrmActivities(filters: {
  branchId?: string;
  dealId?: string;
  completed?: boolean;
  type?: CrmActivityType;
  from?: Date;
  to?: Date;
} = {}) {
  const conditions = [isNull(crmActivities.deletedAt)];
  if (filters.branchId) conditions.push(eq(crmActivities.branchId, filters.branchId));
  if (filters.dealId) conditions.push(eq(crmActivities.dealId, filters.dealId));
  if (filters.type) conditions.push(eq(crmActivities.type, filters.type));
  if (filters.completed === true) conditions.push(sql`${crmActivities.completedAt} is not null`);
  if (filters.completed === false) conditions.push(isNull(crmActivities.completedAt));
  if (filters.from) conditions.push(gte(crmActivities.dueAt, filters.from));
  if (filters.to) conditions.push(lte(crmActivities.dueAt, filters.to));

  const rows = await db
    .select({
      id: crmActivities.id,
      type: crmActivities.type,
      title: crmActivities.title,
      notes: crmActivities.notes,
      dueAt: crmActivities.dueAt,
      completedAt: crmActivities.completedAt,
      dealId: crmActivities.dealId,
      dealTitle: crmDeals.title,
      personId: crmActivities.personId,
      personName: crmPeople.name,
      organizationName: crmOrganizations.name,
      ownerId: crmActivities.ownerId,
      ownerName: users.name,
      createdAt: crmActivities.createdAt,
    })
    .from(crmActivities)
    .leftJoin(crmDeals, eq(crmActivities.dealId, crmDeals.id))
    .leftJoin(crmPeople, eq(crmActivities.personId, crmPeople.id))
    .leftJoin(crmOrganizations, eq(crmActivities.organizationId, crmOrganizations.id))
    .leftJoin(users, eq(crmActivities.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(asc(crmActivities.completedAt), asc(crmActivities.dueAt), desc(crmActivities.createdAt));

  return rows;
}

export async function createCrmActivity(input: CrmActivityInput, actor: AuthUser): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new AppError("VALIDATION_ERROR", "Judul aktivitas wajib diisi.");
  const inserted = await db
    .insert(crmActivities)
    .values({
      branchId: actor.branchId ?? null,
      dealId: input.dealId ?? null,
      personId: input.personId ?? null,
      organizationId: input.organizationId ?? null,
      type: input.type,
      title,
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
      ownerId: input.ownerId ?? actor.id,
      createdBy: actor.id,
    })
    .returning({ id: crmActivities.id });
  return inserted[0].id;
}

export async function completeCrmActivity(id: string, _actor: AuthUser): Promise<void> {
  const existing = await db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.id, id), isNull(crmActivities.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Aktivitas tidak ditemukan.");
  await db
    .update(crmActivities)
    .set({ completedAt: existing[0].completedAt ? null : new Date(), updatedAt: new Date() })
    .where(eq(crmActivities.id, id));
}

export async function deleteCrmActivity(id: string): Promise<void> {
  const existing = await db
    .select({ id: crmActivities.id })
    .from(crmActivities)
    .where(and(eq(crmActivities.id, id), isNull(crmActivities.deletedAt)))
    .limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Aktivitas tidak ditemukan.");
  await db
    .update(crmActivities)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(crmActivities.id, id));
}

/* --------------------------------- Catatan -------------------------------- */

export async function addCrmNote(
  input: { dealId?: string | null; personId?: string | null; organizationId?: string | null; body: string },
  actor: AuthUser
): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new AppError("VALIDATION_ERROR", "Catatan tidak boleh kosong.");
  const inserted = await db
    .insert(crmNotes)
    .values({
      branchId: actor.branchId ?? null,
      dealId: input.dealId ?? null,
      personId: input.personId ?? null,
      organizationId: input.organizationId ?? null,
      body,
      authorId: actor.id,
    })
    .returning({ id: crmNotes.id });
  return inserted[0].id;
}

/* ------------------------------ Pengaturan stage --------------------------- */

export async function createCrmStage(
  input: { pipelineId: string; name: string; description?: string | null; color?: string; type?: CrmStageType },
  _actor: AuthUser
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new AppError("VALIDATION_ERROR", "Nama tahap wajib diisi.");
  const maxPosition = await db
    .select({ max: sql<number>`coalesce(max(${crmStages.position}), -1)::int` })
    .from(crmStages)
    .where(eq(crmStages.pipelineId, input.pipelineId));
  const inserted = await db
    .insert(crmStages)
    .values({
      pipelineId: input.pipelineId,
      name,
      description: input.description ?? null,
      color: input.color ?? "slate",
      type: input.type ?? "OPEN",
      position: Number(maxPosition[0]?.max ?? -1) + 1,
    })
    .returning({ id: crmStages.id });
  return inserted[0].id;
}

export async function updateCrmStage(
  id: string,
  input: { name?: string; description?: string | null; color?: string; type?: CrmStageType; position?: number },
  _actor: AuthUser
): Promise<void> {
  const existing = await db.select().from(crmStages).where(eq(crmStages.id, id)).limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Tahap tidak ditemukan.");
  await db
    .update(crmStages)
    .set({
      name: input.name?.trim() || existing[0].name,
      description: input.description !== undefined ? input.description : existing[0].description,
      color: input.color ?? existing[0].color,
      type: input.type ?? existing[0].type,
      position: input.position ?? existing[0].position,
      updatedAt: new Date(),
    })
    .where(eq(crmStages.id, id));
}

export async function deleteCrmStage(id: string): Promise<void> {
  const existing = await db.select().from(crmStages).where(eq(crmStages.id, id)).limit(1);
  if (existing.length === 0) throw new AppError("NOT_FOUND", "Tahap tidak ditemukan.");
  const used = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmDeals)
    .where(and(eq(crmDeals.stageId, id), isNull(crmDeals.deletedAt)));
  if (Number(used[0]?.count ?? 0) > 0) {
    throw new AppError("VALIDATION_ERROR", "Tahap masih dipakai deal. Pindahkan deal terlebih dahulu.");
  }
  await db.delete(crmStages).where(eq(crmStages.id, id));
}

export async function listBranchOptions(): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name));
}
