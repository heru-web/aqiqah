"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import type { WhatsappGatewayStatus } from "@/lib/whatsapp";
import { requirePermission } from "@/lib/server/auth";
import { createWaKey, deleteWaKey, activateWaKey, getWhatsappStatus, saveWhatsappSettings, sendWhatsapp, sendWhatsappBroadcast } from "@/server/services/whatsapp";

export type WhatsappFormState = { error?: string; success?: boolean; message?: string } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : fallback;
}

function optional(fd: FormData, key: string): string | null {
  const value = field(fd, key).trim();
  return value ? value : null;
}

function message(error: unknown, fallback: string): string {
  return AppError.is(error) ? error.message : fallback;
}

function refreshDeal(dealId: string | null): void {
  revalidatePath("/crm");
  revalidatePath("/crm/contacts");
  revalidatePath("/crm/activities");
  if (dealId) revalidatePath(`/crm/deals/${dealId}`);
}

export async function sendWhatsappAction(
  _prev: WhatsappFormState,
  fd: FormData
): Promise<WhatsappFormState> {
  const actor = await requirePermission("crm.pipeline.action");
  const dealId = optional(fd, "dealId");
  const personId = optional(fd, "personId");

  try {
    const result = await sendWhatsapp({
      to: field(fd, "to"),
      message: field(fd, "message"),
      kind: "MANUAL",
      dealId,
      personId,
      branchId: actor.branchId ?? null,
      actorId: actor.id,
    });
    refreshDeal(dealId);
    if (personId) revalidatePath(`/crm/contacts/people/${personId}`);
    return { success: true, message: `Pesan terkirim ke +${result.phone}.` };
  } catch (error) {
    return { error: message(error, "Gagal mengirim WhatsApp.") };
  }
}

export async function sendWhatsappBroadcastAction(input: {
  recipients: Array<{ phone: string; personId?: string | null }>;
  message: string;
}): Promise<{ ok: boolean; sent?: number; failed?: number; error?: string }> {
  const actor = await requirePermission("crm.pipeline.action");
  try {
    const result = await sendWhatsappBroadcast({
      branchId: actor.branchId ?? null,
      actorId: actor.id,
      recipients: input.recipients,
      message: input.message,
    });
    revalidatePath("/crm");
    revalidatePath("/crm/activities");
    return { ok: true, sent: result.sent, failed: result.failed };
  } catch (error) {
    return { ok: false, error: message(error, "Gagal mengirim WhatsApp broadcast.") };
  }
}

export async function testWhatsappConnectionAction(): Promise<{
  error?: string;
  status?: WhatsappGatewayStatus;
}> {
  await requirePermission("settings.settings.view");
  try {
    const status = await getWhatsappStatus();
    return { status };
  } catch (error) {
    return { error: message(error, "Gagal memeriksa gateway WhatsApp.") };
  }
}

export async function saveWhatsappSettingsAction(
  values: Record<string, unknown>
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requirePermission("settings.settings.update");
  try {
    await saveWhatsappSettings(values, actor);
    revalidatePath("/settings/whatsapp");
    revalidatePath("/crm");
    return { success: true };
  } catch (error) {
    return { error: message(error, "Gagal menyimpan pengaturan WhatsApp.") };
  }
}

export async function createWaKeyAction(fd: FormData): Promise<{ error?: string }> {
  const actor = await requirePermission("settings.settings.update");
  try {
    const token = String(fd.get("token") ?? "").trim();
    const label = String(fd.get("label") ?? "").trim();
    if (!token) return { error: "Token/API key wajib diisi." };
    await createWaKey(
      {
        provider: String(fd.get("provider") ?? "FONNTE"),
        label,
        token,
        phoneId: String(fd.get("phoneId") ?? "").trim() || undefined,
        note: String(fd.get("note") ?? "").trim() || undefined,
      },
      actor.id
    );
    revalidatePath("/settings/whatsapp");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan API key." };
  }
}

export async function deleteWaKeyAction(id: string): Promise<{ error?: string }> {
  await requirePermission("settings.settings.update");
  try {
    await deleteWaKey(id);
    revalidatePath("/settings/whatsapp");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus API key." };
  }
}

export async function activateWaKeyAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("settings.settings.update");
  try {
    await activateWaKey(id, actor);
    revalidatePath("/settings/whatsapp");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengaktifkan API key." };
  }
}

export async function sendInboxReplyAction(
  _prev: WhatsappFormState,
  fd: FormData
): Promise<WhatsappFormState> {
  const actor = await requirePermission("crm.pipeline.action");
  try {
    const result = await sendWhatsapp({
      to: field(fd, "to"),
      message: field(fd, "message"),
      kind: "MANUAL",
      branchId: actor.branchId ?? null,
      actorId: actor.id,
      withSignature: false,
    });
    revalidatePath("/whatsapp");
    return { success: true, message: `Pesan terkirim ke +${result.phone}.` };
  } catch (error) {
    return { error: message(error, "Gagal mengirim WhatsApp.") };
  }
}
