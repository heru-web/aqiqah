"use server";
import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { isLeadStage, type LeadStage } from "@/lib/crm/pipeline";
import { requirePermission } from "@/lib/server/auth";
import {
  addFollowup,
  assignLead,
  cancelFollowup,
  createLead,
  markFollowupDone,
  transitionLead,
  updateLead,
} from "@/server/services/leads";

export type LeadFormState = { error?: string; success?: boolean } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : fallback;
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

function revalidateCrm(leadId?: string): void {
  revalidatePath("/crm");
  if (leadId) revalidatePath(`/crm/${leadId}`);
}

export async function createLeadAction(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  const actor = await requirePermission("crm.pipeline.create");
  try {
    await createLead(
      {
        source: (field(fd, "source") || "WALK_IN") as
          | "REFERRAL"
          | "ADS"
          | "SOCIAL"
          | "MARKETPLACE"
          | "WALK_IN"
          | "WEB"
          | "AFILIATE"
          | "AGEN"
          | "WA_BLAST"
          | "OTHER",
        name: field(fd, "name"),
        phone: optional(fd, "phone"),
        whatsapp: optional(fd, "whatsapp"),
        email: optional(fd, "email"),
        company: optional(fd, "company"),
        city: optional(fd, "city"),
        address: optional(fd, "address"),
        productInterest: optional(fd, "productInterest"),
        budget: optional(fd, "budget") ? BigInt(optional(fd, "budget")!) : undefined,
        notes: optional(fd, "notes"),
        assignedTo: optional(fd, "assignedTo"),
        nextFollowupAt: optionalDate(fd, "nextFollowupAt") ?? undefined,
      },
      actor
    );
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan lead." };
  }
  revalidateCrm();
  return { success: true };
}

export async function updateLeadAction(
  leadId: string,
  _prev: LeadFormState,
  fd: FormData
): Promise<LeadFormState> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("lead", leadId, actor);
  try {
    await updateLead(
      leadId,
      {
        name: field(fd, "name"),
        phone: field(fd, "phone"),
        whatsapp: field(fd, "whatsapp"),
        email: field(fd, "email"),
        company: field(fd, "company"),
        city: field(fd, "city"),
        address: field(fd, "address"),
        source: (field(fd, "source") || "WALK_IN") as
          | "REFERRAL"
          | "ADS"
          | "SOCIAL"
          | "MARKETPLACE"
          | "WALK_IN"
          | "WEB"
          | "AFILIATE"
          | "AGEN"
          | "WA_BLAST"
          | "OTHER",
        productInterest: field(fd, "productInterest"),
        budget: field(fd, "budget") ? BigInt(field(fd, "budget")) : undefined,
        notes: field(fd, "notes"),
        assignedTo: field(fd, "assignedTo") || null,
        nextFollowupAt: field(fd, "nextFollowupAt").trim()
          ? new Date(field(fd, "nextFollowupAt"))
          : null,
      },
      actor
    );
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal memperbarui lead." };
  }
  revalidateCrm(leadId);
  return { success: true };
}

export async function transitionLeadAction(
  leadId: string,
  to: string,
  reason?: string
): Promise<{ error?: string }> {
  if (!isLeadStage(to)) return { error: "Status tujuan tidak dikenal." };
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("lead", leadId, actor);
  try {
    await transitionLead(leadId, to as LeadStage, actor, reason);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengubah status." };
  }
  revalidateCrm(leadId);
  return {};
}

export async function assignLeadAction(
  leadId: string,
  assignedTo: string | null
): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("lead", leadId, actor);
  try {
    await assignLead(leadId, assignedTo || null, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menugaskan lead." };
  }
  revalidateCrm(leadId);
  return {};
}

export async function addFollowupAction(
  _prev: LeadFormState,
  fd: FormData
): Promise<LeadFormState> {
  const actor = await requirePermission("crm.followups.create");
  const leadId = field(fd, "leadId");
  try {
    await addFollowup(
      {
        leadId,
        method: (field(fd, "method") || "WA") as "WA" | "CALL" | "MEETING" | "EMAIL",
        summary: optional(fd, "summary"),
        dueAt: optionalDate(fd, "dueAt") ?? undefined,
      },
      actor
    );
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mencatat follow-up." };
  }
  revalidateCrm(leadId);
  return { success: true };
}

export async function markFollowupDoneAction(followupId: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.followups.update");
  await assertResourceAccess("followup", followupId, actor);
  try {
    await markFollowupDone(followupId, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyelesaikan follow-up." };
  }
  revalidateCrm();
  return {};
}

export async function cancelFollowupAction(followupId: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.followups.delete");
  await assertResourceAccess("followup", followupId, actor);
  try {
    await cancelFollowup(followupId, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal membatalkan follow-up." };
  }
  revalidateCrm();
  return {};
}

export async function updateLeadNotesAction(leadId: string, notes: string): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.pipeline.update");
  await assertResourceAccess("lead", leadId, actor);
  try {
    await updateLead(leadId, { notes }, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal memperbarui catatan." };
  }
  revalidateCrm(leadId);
  return {};
}
