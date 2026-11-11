import "server-only";
import type { Tx } from "./audit";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotifyChannel = "IN_APP" | "WA" | "EMAIL" | "TELEGRAM" | "PUSH";

export interface NotifyInput {
  userId?: string | null;
  branchId?: string | null;
  channel?: NotifyChannel;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface ExternalProvider {
  send(input: NotifyInput): Promise<{ ok: boolean; ref?: string; reason?: string }>;
}

class DisabledProvider implements ExternalProvider {
  async send(_input: NotifyInput) {
    return { ok: false, reason: "PROVIDER_DISABLED" };
  }
}

class TelegramProvider implements ExternalProvider {
  async send(input: NotifyInput) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { ok: false, reason: "TELEGRAM_NOT_CONFIGURED" };
    try {
      const text = `${input.title}${input.body ? `\n${input.body}` : ""}`;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      const data = (await res.json()) as { ok: boolean; result?: { message_id?: number } };
      return { ok: !!data.ok, ref: data.result?.message_id ? `tg_${data.result.message_id}` : undefined };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "network" };
    }
  }
}

class WhatsAppProvider implements ExternalProvider {
  async send(_input: NotifyInput) {
    // Adapter WA (WhatsApp Business API) diisi pada Phase 7 — bukan fake.
    return { ok: false, reason: "WA_ADAPTER_NOT_IMPLEMENTED" };
  }
}

class EmailProvider implements ExternalProvider {
  async send(_input: NotifyInput) {
    return { ok: false, reason: "EMAIL_ADAPTER_NOT_IMPLEMENTED" };
  }
}

function providerFor(channel: NotifyChannel): ExternalProvider {
  switch (channel) {
    case "TELEGRAM":
      return new TelegramProvider();
    case "WA":
      return new WhatsAppProvider();
    case "EMAIL":
      return new EmailProvider();
    default:
      return new DisabledProvider();
  }
}

/** Simpan notifikasi in-app (tampil di bell). */
export async function createInAppNotification(input: NotifyInput, exec: Tx | typeof db = db): Promise<string> {
  const [row] = await exec
    .insert(notifications)
    .values({
      userId: input.userId ?? null,
      branchId: input.branchId ?? null,
      channel: "IN_APP",
      title: input.title,
      body: input.body ?? null,
      data: input.data ?? null,
    })
    .returning({ id: notifications.id });
  return row.id;
}

/**
 * Kirim notifikasi eksternal. Mengembalikan false bila provider
 * nonaktif/kurang konfigurasi — TIDAK melempar error agar alur utama
 * tidak gagal hanya karena kanal notifikasi.
 */
export async function sendExternal(input: NotifyInput & { channel: Exclude<NotifyChannel, "IN_APP"> }): Promise<{ ok: boolean; reason?: string }> {
  const config = process.env[`NOTIFY_${input.channel}`];
  if (config === "off") return { ok: false, reason: "DISABLED" };
  const res = await providerFor(input.channel).send(input);
  if (res.ok) {
    await createInAppNotification({ ...input, channel: "IN_APP" });
  }
  return res;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const { requireAuth } = await import("./auth");
  const actor = await requireAuth();
  if (actor.id !== userId) throw new Error("FORBIDDEN");
  const { markRead } = await import("@/server/services/notifications");
  await markRead(id, actor);
}
