"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import {
  addCrmNote,
  completeCrmActivity,
  createCrmActivity,
  createCrmDeal,
  createCrmOrganization,
  createCrmPerson,
  createCrmStage,
  deleteCrmActivity,
  deleteCrmDeal,
  deleteCrmOrganization,
  deleteCrmPerson,
  deleteCrmStage,
  moveCrmDeal,
  updateCrmDeal,
  updateCrmOrganization,
  updateCrmPerson,
  updateCrmStage,
  type CrmActivityType,
  type CrmStageType,
} from "@/server/services/crm";

export type CrmDuplicateInfo = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

export type CrmFormState = { error?: string; success?: boolean; duplicate?: CrmDuplicateInfo | null } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : fallback;
}

function optional(fd: FormData, key: string): string | undefined {
  const value = field(fd, key).trim();
  return value ? value : undefined;
}

function optionalDate(fd: FormData, key: string): Date | null | undefined {
  const value = field(fd, key).trim();
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function optionalBigInt(fd: FormData, key: string): bigint | undefined {
  const value = field(fd, key).replace(/[^\d-]/g, "");
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function refreshDeal(dealId?: string): void {
  revalidatePath("/crm");
  revalidatePath("/crm/contacts");
  revalidatePath("/crm/activities");
  if (dealId) revalidatePath(`/crm/deals/${dealId}`);
}

function refreshContacts(): void {
  revalidatePath("/crm");
  revalidatePath("/crm/contacts");
}

function message(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

function duplicateFromErr(err: unknown): CrmDuplicateInfo | null {
  if (!AppError.is(err)) return null;
  const details = err.details as { duplicate?: CrmDuplicateInfo } | undefined;
  return details?.duplicate ?? null;
}

export async function createDealAction(_prev: CrmFormState, fd: FormData): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await createCrmDeal(
      {
        title: field(fd, "title"),
        value: optionalBigInt(fd, "value"),
        stageId: field(fd, "stageId"),
        personId: optional(fd, "personId") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        ownerId: optional(fd, "ownerId") ?? actor.id,
        source: optional(fd, "source") ?? null,
        productInterest: optional(fd, "productInterest") ?? null,
        expectedCloseDate: optionalDate(fd, "expectedCloseDate") ?? null,
        notes: optional(fd, "notes") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menyimpan deal.") };
  }
  refreshDeal();
  return { success: true };
}

export async function updateDealAction(
  dealId: string,
  _prev: CrmFormState,
  fd: FormData
): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("deal", dealId, actor);
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await updateCrmDeal(
      dealId,
      {
        title: field(fd, "title"),
        value: optionalBigInt(fd, "value"),
        stageId: field(fd, "stageId"),
        personId: optional(fd, "personId") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        ownerId: optional(fd, "ownerId") ?? null,
        source: optional(fd, "source") ?? null,
        productInterest: optional(fd, "productInterest") ?? null,
        expectedCloseDate: optionalDate(fd, "expectedCloseDate") ?? null,
        notes: optional(fd, "notes") ?? null,
        lostReason: optional(fd, "lostReason") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal memperbarui deal.") };
  }
  refreshDeal(dealId);
  return { success: true };
}

export async function moveDealAction(
  dealId: string,
  stageId: string
): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("deal", dealId, actor);
  try {
    await moveCrmDeal(dealId, stageId, actor);
  } catch (err) {
    return { error: message(err, "Gagal memindahkan deal.") };
  }
  refreshDeal(dealId);
  return {};
}

export async function deleteDealAction(dealId: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.delete");
  await assertResourceAccess("deal", dealId, actor);
  try {
    await deleteCrmDeal(dealId, actor);
  } catch (err) {
    return { error: message(err, "Gagal menghapus deal.") };
  }
  refreshDeal(dealId);
  return {};
}

export async function createPersonAction(_prev: CrmFormState, fd: FormData): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await createCrmPerson(
      {
        name: field(fd, "name"),
        phone: optional(fd, "phone") ?? null,
        whatsapp: optional(fd, "whatsapp") ?? null,
        email: optional(fd, "email") ?? null,
        jobTitle: optional(fd, "jobTitle") ?? null,
        city: optional(fd, "city") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        ownerId: optional(fd, "ownerId") ?? actor.id,
        notes: optional(fd, "notes") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menyimpan kontak."), duplicate: duplicateFromErr(err) };
  }
  refreshContacts();
  return { success: true };
}

export async function updatePersonAction(
  personId: string,
  _prev: CrmFormState,
  fd: FormData
): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("person", personId, actor);
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await updateCrmPerson(
      personId,
      {
        name: field(fd, "name"),
        phone: optional(fd, "phone") ?? null,
        whatsapp: optional(fd, "whatsapp") ?? null,
        email: optional(fd, "email") ?? null,
        jobTitle: optional(fd, "jobTitle") ?? null,
        city: optional(fd, "city") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        ownerId: optional(fd, "ownerId") ?? null,
        notes: optional(fd, "notes") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal memperbarui kontak."), duplicate: duplicateFromErr(err) };
  }
  refreshContacts();
  return { success: true };
}

export async function deletePersonAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.delete");
  await assertResourceAccess("person", id, actor);
  try {
    await deleteCrmPerson(id);
  } catch (err) {
    return { error: message(err, "Gagal menghapus kontak.") };
  }
  refreshContacts();
  return {};
}

export async function createOrganizationAction(
  _prev: CrmFormState,
  fd: FormData
): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    await createCrmOrganization(
      {
        name: field(fd, "name"),
        industry: optional(fd, "industry") ?? null,
        phone: optional(fd, "phone") ?? null,
        email: optional(fd, "email") ?? null,
        city: optional(fd, "city") ?? null,
        address: optional(fd, "address") ?? null,
        ownerId: optional(fd, "ownerId") ?? actor.id,
        notes: optional(fd, "notes") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menyimpan perusahaan."), duplicate: duplicateFromErr(err) };
  }
  refreshContacts();
  return { success: true };
}

export async function updateOrganizationAction(
  organizationId: string,
  _prev: CrmFormState,
  fd: FormData
): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("organization", organizationId, actor);
  try {
    await updateCrmOrganization(
      organizationId,
      {
        name: field(fd, "name"),
        industry: optional(fd, "industry") ?? null,
        phone: optional(fd, "phone") ?? null,
        email: optional(fd, "email") ?? null,
        city: optional(fd, "city") ?? null,
        address: optional(fd, "address") ?? null,
        ownerId: optional(fd, "ownerId") ?? null,
        notes: optional(fd, "notes") ?? null,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal memperbarui perusahaan."), duplicate: duplicateFromErr(err) };
  }
  refreshContacts();
  return { success: true };
}

export async function deleteOrganizationAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.delete");
  await assertResourceAccess("organization", id, actor);
  try {
    await deleteCrmOrganization(id);
  } catch (err) {
    return { error: message(err, "Gagal menghapus perusahaan.") };
  }
  refreshContacts();
  return {};
}

export async function createActivityAction(_prev: CrmFormState, fd: FormData): Promise<CrmFormState> {
  const actor = await requirePermission("crm.followups.create");
  const type = (field(fd, "type") || "TASK") as CrmActivityType;
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await createCrmActivity(
      {
        dealId: optional(fd, "dealId") ?? null,
        personId: optional(fd, "personId") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        type,
        title: field(fd, "title"),
        notes: optional(fd, "notes") ?? null,
        dueAt: optionalDate(fd, "dueAt") ?? null,
        ownerId: optional(fd, "ownerId") ?? actor.id,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menyimpan aktivitas.") };
  }
  refreshDeal(optional(fd, "dealId"));
  return { success: true };
}

export async function completeActivityAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.followups.update");
  await assertResourceAccess("activity", id, actor);
  try {
    await completeCrmActivity(id, actor);
  } catch (err) {
    return { error: message(err, "Gagal memperbarui aktivitas.") };
  }
  revalidatePath("/crm");
  revalidatePath("/crm/activities");
  return {};
}

export async function deleteActivityAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.followups.delete");
  await assertResourceAccess("activity", id, actor);
  try {
    await deleteCrmActivity(id);
  } catch (err) {
    return { error: message(err, "Gagal menghapus aktivitas.") };
  }
  revalidatePath("/crm");
  revalidatePath("/crm/activities");
  return {};
}

export async function addNoteAction(_prev: CrmFormState, fd: FormData): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    if (optional(fd, "personId")) await assertResourceAccess("person", optional(fd, "personId") as string, actor);
    if (optional(fd, "organizationId")) await assertResourceAccess("organization", optional(fd, "organizationId") as string, actor);
    if (optional(fd, "dealId")) await assertResourceAccess("deal", optional(fd, "dealId") as string, actor);
    await addCrmNote(
      {
        dealId: optional(fd, "dealId") ?? null,
        personId: optional(fd, "personId") ?? null,
        organizationId: optional(fd, "organizationId") ?? null,
        body: field(fd, "body"),
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menyimpan catatan.") };
  }
  refreshDeal(optional(fd, "dealId"));
  return { success: true };
}

export async function createStageAction(_prev: CrmFormState, fd: FormData): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    await createCrmStage(
      {
        pipelineId: field(fd, "pipelineId"),
        name: field(fd, "name"),
        description: optional(fd, "description") ?? null,
        color: field(fd, "color", "slate"),
        type: (field(fd, "type", "OPEN") as CrmStageType) ?? "OPEN",
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal menambah tahap.") };
  }
  revalidatePath("/crm");
  revalidatePath("/crm/pengaturan");
  return { success: true };
}

export async function updateStageAction(
  stageId: string,
  _prev: CrmFormState,
  fd: FormData
): Promise<CrmFormState> {
  const actor = await requirePermission("crm.pipeline.update");
  try {
    await updateCrmStage(
      stageId,
      {
        name: field(fd, "name"),
        description: optional(fd, "description") ?? null,
        color: field(fd, "color", "slate"),
        type: field(fd, "type", "OPEN") as CrmStageType,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal memperbarui tahap.") };
  }
  revalidatePath("/crm");
  revalidatePath("/crm/pengaturan");
  return { success: true };
}

export async function deleteStageAction(id: string): Promise<{ error?: string }> {
  await requirePermission("crm.pipeline.delete");
  try {
    await deleteCrmStage(id);
  } catch (err) {
    return { error: message(err, "Gagal menghapus tahap.") };
  }
  revalidatePath("/crm");
  revalidatePath("/crm/pengaturan");
  return {};
}
