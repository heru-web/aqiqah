/**
 * Migrasi CRM lama -> CRM v2 (tabel `crm_*`).
 *
 * Sumber:
 * - customers       -> crm_organizations (PERUSAHAAN) / crm_people (PERORANGAN)
 * - leads           -> crm_deals + crm_people
 * - lead_followups  -> crm_activities
 * - notes lama      -> crm_notes
 *
 * Idempoten: setiap baris dicek lewat kolom `legacy*` sebelum dibuat.
 * Jalankan: npm run db:migrate:crm
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, sql as pg } from "@/db";
import {
  crmActivities,
  crmDeals,
  crmNotes,
  crmOrganizations,
  crmPeople,
  crmPipelines,
  crmStages,
  customers,
  leadFollowups,
  leads,
} from "@/db/schema";

const DEFAULT_STAGES = [
  { name: "Lead Baru", description: "Prospek masuk, belum dihubungi.", color: "slate", type: "OPEN" as const, position: 0 },
  { name: "Dihubungi", description: "Sudah ada kontak pertama.", color: "blue", type: "OPEN" as const, position: 1 },
  { name: "Minat", description: "Tertarik, masih pertimbangan.", color: "amber", type: "OPEN" as const, position: 2 },
  { name: "Penawaran", description: "Penawaran sudah dikirim.", color: "violet", type: "OPEN" as const, position: 3 },
  { name: "DP Masuk", description: "Komitmen DP diterima.", color: "emerald", type: "OPEN" as const, position: 4 },
  { name: "Selesai", description: "Prospek selesai / deal won.", color: "emerald", type: "WON" as const, position: 5 },
  { name: "Batal", description: "Prospek berhenti / deal lost.", color: "rose", type: "LOST" as const, position: 6 },
];

const PRODUCT_LABELS: Record<string, string> = {
  kambing: "Kambing",
  sapi: "Sapi",
  paket: "Paket Olahan",
  pesanan_olah: "Pesanan Olahan",
};

type StageType = "OPEN" | "WON" | "LOST";

async function ensurePipeline() {
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
      .values({ name: "Pipeline Penjualan", isDefault: true })
      .returning();
    pipeline = inserted[0];
    console.log("Pipeline default dibuat.");
  }

  let stages = await db
    .select()
    .from(crmStages)
    .where(eq(crmStages.pipelineId, pipeline.id))
    .orderBy(asc(crmStages.position));

  if (stages.length === 0) {
    stages = await db
      .insert(crmStages)
      .values(DEFAULT_STAGES.map((stage) => ({ ...stage, pipelineId: pipeline.id })))
      .returning();
    console.log("7 tahap default dibuat.");
  }

  return { pipelineId: pipeline.id, stages };
}

function pickStage(
  stages: Array<{ id: string; name: string; type: StageType }>,
  name: string,
  type: StageType
): string {
  return stages.find((stage) => stage.name === name)?.id ?? stages.find((stage) => stage.type === type)?.id ?? stages[0].id;
}

function stageForLegacyStatus(
  stages: Array<{ id: string; name: string; type: StageType }>,
  status: string,
  closedReason: string | null
): string {
  switch (status) {
    case "CONTACTED":
      return pickStage(stages, "Dihubungi", "OPEN");
    case "INTERESTED":
      return pickStage(stages, "Minat", "OPEN");
    case "QUOTATION":
      return pickStage(stages, "Penawaran", "OPEN");
    case "DP":
      return pickStage(stages, "DP Masuk", "OPEN");
    case "CLOSED":
      return /batal|cancel|lost/i.test(closedReason ?? "")
        ? pickStage(stages, "Batal", "LOST")
        : pickStage(stages, "Selesai", "WON");
    default:
      return pickStage(stages, "Lead Baru", "OPEN");
  }
}

function activityType(method: string): "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "TASK" {
  switch (method) {
    case "CALL":
      return "CALL";
    case "WA":
      return "WHATSAPP";
    case "EMAIL":
      return "EMAIL";
    case "MEETING":
      return "MEETING";
    default:
      return "TASK";
  }
}

function activityTitle(summary: string | null, fallback: string): string {
  const firstLine = (summary ?? "").split("\n")[0]?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;
}

async function main() {
  const { pipelineId, stages } = await ensurePipeline();
  const stageRows = stages as Array<{ id: string; name: string; type: StageType }>;

  const maxRows = await db
    .select({
      stageId: crmDeals.stageId,
      max: sql<number>`coalesce(max(${crmDeals.position}), 0)::int`,
    })
    .from(crmDeals)
    .groupBy(crmDeals.stageId);
  const positions = new Map(maxRows.map((row) => [row.stageId, Number(row.max)]));
  function nextPosition(stageId: string): number {
    const next = (positions.get(stageId) ?? 0) + 1;
    positions.set(stageId, next);
    return next;
  }

  const customerRows = await db.select().from(customers).where(isNull(customers.deletedAt));
  const customerOrganizations = new Map<string, string>();
  const customerPeople = new Map<string, string>();
  let orgCount = 0;
  let personCount = 0;

  for (const customer of customerRows) {
    if (customer.type === "PERUSAHAAN") {
      const existing = await db
        .select({ id: crmOrganizations.id })
        .from(crmOrganizations)
        .where(eq(crmOrganizations.legacyCustomerId, customer.id))
        .limit(1);

      let id = existing[0]?.id;
      if (!id) {
        const inserted = await db
          .insert(crmOrganizations)
          .values({
            branchId: customer.branchId,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            city: customer.city,
            address: customer.address,
            notes: customer.notes,
            ownerId: customer.createdBy,
            legacyCustomerId: customer.id,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          })
          .returning({ id: crmOrganizations.id });
        id = inserted[0].id;
        orgCount += 1;
      }
      customerOrganizations.set(customer.id, id);

      if (customer.notes) {
        const noteExists = await db
          .select({ id: crmNotes.id })
          .from(crmNotes)
          .where(and(eq(crmNotes.organizationId, id), eq(crmNotes.body, customer.notes)))
          .limit(1);
        if (noteExists.length === 0) {
          await db.insert(crmNotes).values({
            branchId: customer.branchId,
            organizationId: id,
            body: customer.notes,
            authorId: customer.createdBy,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          });
        }
      }
    } else {
      const existing = await db
        .select({ id: crmPeople.id })
        .from(crmPeople)
        .where(eq(crmPeople.legacyCustomerId, customer.id))
        .limit(1);

      let id = existing[0]?.id;
      if (!id) {
        const inserted = await db
          .insert(crmPeople)
          .values({
            branchId: customer.branchId,
            name: customer.name,
            phone: customer.phone,
            whatsapp: customer.whatsapp,
            email: customer.email,
            city: customer.city,
            notes: customer.notes,
            ownerId: customer.createdBy,
            legacyCustomerId: customer.id,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          })
          .returning({ id: crmPeople.id });
        id = inserted[0].id;
        personCount += 1;
      }
      customerPeople.set(customer.id, id);

      if (customer.notes) {
        const noteExists = await db
          .select({ id: crmNotes.id })
          .from(crmNotes)
          .where(and(eq(crmNotes.personId, id), eq(crmNotes.body, customer.notes)))
          .limit(1);
        if (noteExists.length === 0) {
          await db.insert(crmNotes).values({
            branchId: customer.branchId,
            personId: id,
            body: customer.notes,
            authorId: customer.createdBy,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          });
        }
      }
    }
  }

  const companyOrganizations = new Map<string, string>();
  function companyKey(branchId: string, name: string): string {
    return `${branchId}::${name.trim().toLowerCase()}`;
  }

  async function findOrCreateOrganization(branchId: string, name: string, ownerId: string | null): Promise<string> {
    const key = companyKey(branchId, name);
    const cached = companyOrganizations.get(key);
    if (cached) return cached;

    const existing = await db
      .select({ id: crmOrganizations.id })
      .from(crmOrganizations)
      .where(
        and(
          eq(crmOrganizations.branchId, branchId),
          sql`lower(${crmOrganizations.name}) = ${name.trim().toLowerCase()}`,
          isNull(crmOrganizations.deletedAt)
        )
      )
      .limit(1);

    let id = existing[0]?.id;
    if (!id) {
      const inserted = await db
        .insert(crmOrganizations)
        .values({ branchId, name: name.trim(), ownerId })
        .returning({ id: crmOrganizations.id });
      id = inserted[0].id;
      orgCount += 1;
    }
    companyOrganizations.set(key, id);
    return id;
  }

  const leadRows = await db.select().from(leads).where(isNull(leads.deletedAt));
  const leadDeals = new Map<string, string>();
  const leadPeople = new Map<string, string>();
  let dealCount = 0;

  for (const lead of leadRows) {
    let personId = lead.customerId ? customerPeople.get(lead.customerId) : undefined;

    if (!personId) {
      const existingPerson = await db
        .select({ id: crmPeople.id })
        .from(crmPeople)
        .where(eq(crmPeople.legacyLeadId, lead.id))
        .limit(1);

      personId = existingPerson[0]?.id;
      if (!personId) {
        const inserted = await db
          .insert(crmPeople)
          .values({
            branchId: lead.branchId,
            name: lead.name,
            phone: lead.phone,
            whatsapp: lead.whatsapp,
            email: lead.email,
            city: lead.city,
            notes: lead.notes,
            ownerId: lead.assignedTo,
            legacyLeadId: lead.id,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
          })
          .returning({ id: crmPeople.id });
        personId = inserted[0].id;
        personCount += 1;
      }
    }
    leadPeople.set(lead.id, personId);

    let organizationId = lead.customerId ? customerOrganizations.get(lead.customerId) : undefined;
    if (!organizationId && lead.company) {
      organizationId = await findOrCreateOrganization(lead.branchId, lead.company, lead.assignedTo);
    }

    const existingDeal = await db
      .select({ id: crmDeals.id })
      .from(crmDeals)
      .where(eq(crmDeals.legacyLeadId, lead.id))
      .limit(1);

    let dealId = existingDeal[0]?.id;
    if (!dealId) {
      const stageId = stageForLegacyStatus(stageRows, lead.status, lead.closedReason);
      const stageType = stageRows.find((stage) => stage.id === stageId)?.type ?? "OPEN";
      const title = `${lead.name}${
        lead.productInterest ? ` · ${PRODUCT_LABELS[lead.productInterest] ?? lead.productInterest}` : ""
      }`;

      const inserted = await db
        .insert(crmDeals)
        .values({
          branchId: lead.branchId,
          pipelineId,
          stageId,
          title,
          value: lead.budget ?? 0n,
          source: lead.source,
          productInterest: lead.productInterest,
          personId,
          organizationId: organizationId ?? null,
          ownerId: lead.assignedTo,
          notes: lead.notes,
          position: nextPosition(stageId),
          legacyLeadId: lead.id,
          closedAt: stageType === "OPEN" ? null : (lead.closedAt ?? lead.updatedAt),
          lostReason: stageType === "LOST" ? lead.closedReason : null,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        })
        .returning({ id: crmDeals.id });
      dealId = inserted[0].id;
      dealCount += 1;
    }
    leadDeals.set(lead.id, dealId);

    if (lead.notes) {
      const noteExists = await db
        .select({ id: crmNotes.id })
        .from(crmNotes)
        .where(and(eq(crmNotes.dealId, dealId), eq(crmNotes.body, lead.notes)))
        .limit(1);
      if (noteExists.length === 0) {
        await db.insert(crmNotes).values({
          branchId: lead.branchId,
          dealId,
          personId,
          organizationId: organizationId ?? null,
          body: lead.notes,
          authorId: lead.createdBy,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        });
      }
    }
  }

  console.log(`Kontak: ${personCount} orang baru, ${orgCount} perusahaan baru, ${dealCount} deal baru.`);

  const followupRows = await db.select().from(leadFollowups);
  let activityCount = 0;

  for (const followup of followupRows) {
    const dealId = leadDeals.get(followup.leadId);
    if (!dealId) continue;
    const personId = leadPeople.get(followup.leadId) ?? null;

    const existing = await db
      .select({ id: crmActivities.id })
      .from(crmActivities)
      .where(eq(crmActivities.legacyFollowupId, followup.id))
      .limit(1);
    if (existing.length > 0) continue;

    const lead = leadRows.find((item) => item.id === followup.leadId);
    await db.insert(crmActivities).values({
      branchId: lead?.branchId ?? null,
      dealId,
      personId,
      type: activityType(followup.method),
      title: activityTitle(followup.summary, followup.method === "WA" ? "Follow-up WhatsApp" : "Follow-up prospek"),
      notes: followup.summary,
      dueAt: followup.dueAt,
      completedAt: followup.completedAt ?? (followup.status === "DONE" ? followup.updatedAt : null),
      ownerId: followup.agentId ?? lead?.assignedTo ?? null,
      createdBy: followup.agentId ?? lead?.createdBy ?? null,
      legacyFollowupId: followup.id,
      createdAt: followup.createdAt,
      updatedAt: followup.updatedAt,
    });
    activityCount += 1;
  }

  console.log(`Aktivitas: ${activityCount} follow-up dimigrasikan.`);
  console.log("Migrasi CRM v2 selesai.");
}

main()
  .catch((error) => {
    console.error("Migrasi CRM v2 gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end();
  });
