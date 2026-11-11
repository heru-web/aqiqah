import "server-only";
import {and, eq, inArray, isNull,
  desc
} from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  crmActivities,
  crmDeals,
  crmOrganizations,
  crmPeople,
  crmStages,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { formatIDR } from "@/lib/utils";
import {
  WHATSAPP_SETTING_KEYS,
  WHATSAPP_SETTING_KEY_LIST,
  normalizeWhatsappPhone,
  renderWhatsappTemplate,
  type WhatsappGatewayStatus,
  type WhatsappSettings,
  type WhatsappTemplate,
} from "@/lib/whatsapp";
import { waApiKeys } from "@/db/schema/erp-extensions";
import { ne } from "drizzle-orm";
import type { AuthUser } from "@/lib/server/auth";

export interface SendWhatsappInput {
  to: string;
  message: string;
  kind?: "MANUAL" | "AUTO" | "BROADCAST";
  dealId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  actorId?: string | null;
  /** Default true. Inbox chat mengirim tanpa tanda tangan agar percakapan tetap natural. */
  withSignature?: boolean;
}

export interface SendWhatsappResult {
  ok: true;
  id: string | null;
  phone: string;
  message: string;
}

export type AutoWhatsappTrigger = "DEAL_CREATED" | "STAGE_CHANGED";

const DEFAULT_GATEWAY_URL = process.env.WA_GATEWAY_URL ?? "http://127.0.0.1:3015";
const DEFAULT_GATEWAY_TOKEN = process.env.WA_GATEWAY_TOKEN ?? "";

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  provider: "WAHA",
  enabled: true,
  gatewayUrl: DEFAULT_GATEWAY_URL,
  apiToken: DEFAULT_GATEWAY_TOKEN,
  deviceLabel: "CRM Madani Aqiqah",
  countryCode: "62",
  signature: "— Tim Madani Aqiqah",
  autoEnabled: false,
  autoOnCreate: true,
  autoOnStageChange: true,
  autoStageId: "",
  templateNewDeal:
    "Halo {nama}, terima kasih sudah menghubungi Madani Aqiqah. Kami siap membantu rencana aqiqah {produk} untuk {nama}. Boleh kami tahu tanggal acara dan jumlah tamannya?",
  templateStageChange:
    "Halo {nama}, kabar baik! Prospek {judul} kini berada di tahap {tahap}. Kami siap membantu sampai acara berlangsung. Silakan hubungi kami bila ada yang ingin ditanyakan.",
  templateManual:
    "Halo {nama}, terima kasih telah menghubungi Madani Aqiqah. Ada yang bisa kami bantu terkait rencana aqiqah Anda?",
  fonnteToken: "",
  cloudToken: "",
  cloudPhoneId: "",
  cloudTemplate: "",
  alarmSuperadminPhone: "",
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stripQuotes(value: unknown): unknown {
  if (typeof value === "string" && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export async function getWhatsappSettings(): Promise<WhatsappSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, WHATSAPP_SETTING_KEY_LIST));

  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: string, fallback: unknown) => stripQuotes(stored.has(key) ? stored.get(key) : fallback);

  const providerRaw = asString(read(WHATSAPP_SETTING_KEYS.provider, "WAHA")).toUpperCase();
  const provider = providerRaw === "FONNTE" || providerRaw === "CLOUD" ? providerRaw : "WAHA";

  return {
    provider,
    enabled: asBoolean(read(WHATSAPP_SETTING_KEYS.enabled, DEFAULT_WHATSAPP_SETTINGS.enabled), DEFAULT_WHATSAPP_SETTINGS.enabled),
    fonnteToken: asString(read(WHATSAPP_SETTING_KEYS.fonnteToken, ""), ""),
    cloudToken: asString(read(WHATSAPP_SETTING_KEYS.cloudToken, ""), ""),
    cloudPhoneId: asString(read(WHATSAPP_SETTING_KEYS.cloudPhoneId, ""), "").replace(/\D/g, ""),
    cloudTemplate: asString(read(WHATSAPP_SETTING_KEYS.cloudTemplate, ""), ""),
    alarmSuperadminPhone: asString(read(WHATSAPP_SETTING_KEYS.alarmSuperadminPhone, ""), "").replace(/[^0-9]/g, ""),
    gatewayUrl: asString(
      read(WHATSAPP_SETTING_KEYS.gatewayUrl, DEFAULT_WHATSAPP_SETTINGS.gatewayUrl),
      DEFAULT_WHATSAPP_SETTINGS.gatewayUrl
    ),
    apiToken: asString(
      read(WHATSAPP_SETTING_KEYS.apiToken, DEFAULT_WHATSAPP_SETTINGS.apiToken),
      DEFAULT_WHATSAPP_SETTINGS.apiToken
    ),
    deviceLabel: asString(
      read(WHATSAPP_SETTING_KEYS.deviceLabel, DEFAULT_WHATSAPP_SETTINGS.deviceLabel),
      DEFAULT_WHATSAPP_SETTINGS.deviceLabel
    ),
    countryCode: asString(
      read(WHATSAPP_SETTING_KEYS.countryCode, DEFAULT_WHATSAPP_SETTINGS.countryCode),
      DEFAULT_WHATSAPP_SETTINGS.countryCode
    ),
    signature: asString(
      read(WHATSAPP_SETTING_KEYS.signature, DEFAULT_WHATSAPP_SETTINGS.signature),
      DEFAULT_WHATSAPP_SETTINGS.signature
    ),
    autoEnabled: asBoolean(
      read(WHATSAPP_SETTING_KEYS.autoEnabled, DEFAULT_WHATSAPP_SETTINGS.autoEnabled),
      DEFAULT_WHATSAPP_SETTINGS.autoEnabled
    ),
    autoOnCreate: asBoolean(
      read(WHATSAPP_SETTING_KEYS.autoOnCreate, DEFAULT_WHATSAPP_SETTINGS.autoOnCreate),
      DEFAULT_WHATSAPP_SETTINGS.autoOnCreate
    ),
    autoOnStageChange: asBoolean(
      read(WHATSAPP_SETTING_KEYS.autoOnStageChange, DEFAULT_WHATSAPP_SETTINGS.autoOnStageChange),
      DEFAULT_WHATSAPP_SETTINGS.autoOnStageChange
    ),
    autoStageId: asString(
      read(WHATSAPP_SETTING_KEYS.autoStageId, DEFAULT_WHATSAPP_SETTINGS.autoStageId),
      DEFAULT_WHATSAPP_SETTINGS.autoStageId
    ),
    templateNewDeal: asString(
      read(WHATSAPP_SETTING_KEYS.templateNewDeal, DEFAULT_WHATSAPP_SETTINGS.templateNewDeal),
      DEFAULT_WHATSAPP_SETTINGS.templateNewDeal
    ),
    templateStageChange: asString(
      read(WHATSAPP_SETTING_KEYS.templateStageChange, DEFAULT_WHATSAPP_SETTINGS.templateStageChange),
      DEFAULT_WHATSAPP_SETTINGS.templateStageChange
    ),
    templateManual: asString(
      read(WHATSAPP_SETTING_KEYS.templateManual, DEFAULT_WHATSAPP_SETTINGS.templateManual),
      DEFAULT_WHATSAPP_SETTINGS.templateManual
    ),
  };
}

function joinUrl(base: string, path: string): string {
  const root = base.trim().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}

async function gatewayFetch(
  settings: WhatsappSettings,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (settings.apiToken.trim()) headers.set("Authorization", `Bearer ${settings.apiToken.trim()}`);

  return fetch(joinUrl(settings.gatewayUrl, path), {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
}

export async function getWhatsappStatus(): Promise<WhatsappGatewayStatus> {
  const providerSettings = await getWhatsappSettings();
  const checkedAt = new Date().toISOString();

  if (providerSettings.provider === "FONNTE") {
    const hasKey = Boolean(providerSettings.fonnteToken.trim());
    return {
      reachable: true,
      ready: hasKey,
      status: hasKey ? "fonnte_api_key_terisi" : "fonnte_api_key_kosong",
      error: hasKey ? null : "Isi API key Fonnte di Pengaturan.",
      checkedAt,
    };
  }
  if (providerSettings.provider === "CLOUD") {
    const okCfg = Boolean(providerSettings.cloudToken.trim() && providerSettings.cloudPhoneId.trim());
    return {
      reachable: true,
      ready: okCfg,
      status: okCfg ? "cloud_api_konfigurasi_ok" : "cloud_api_konfigurasi_kurang",
      error: okCfg ? null : "Isi Access Token & Phone Number ID Cloud API.",
      checkedAt,
    };
  }

  const settings = providerSettings;

  if (!settings.gatewayUrl.trim()) {
    return { reachable: false, ready: false, status: "not_configured", error: "URL gateway belum diisi.", checkedAt };
  }

  try {
    const response = await gatewayFetch(settings, "/health", { method: "GET" });
    if (!response.ok) {
      return {
        reachable: true,
        ready: false,
        status: `http_${response.status}`,
        error: `Gateway menjawab HTTP ${response.status}.`,
        checkedAt,
      };
    }

    const data = (await response.json()) as {
      ready?: boolean;
      status?: string;
      engine?: string;
      me?: { id?: string; name?: string } | null;
      lastError?: { message?: string } | string | null;
    };

    const lastError =
      typeof data.lastError === "string"
        ? data.lastError
        : data.lastError && typeof data.lastError === "object"
          ? (data.lastError.message ?? null)
          : null;

    return {
      reachable: true,
      ready: Boolean(data.ready),
      status: data.status ?? (data.ready ? "ready" : "unknown"),
      engine: data.engine ?? null,
      me: data.me ?? null,
      error: lastError,
      checkedAt,
    };
  } catch (error) {
    return {
      reachable: false,
      ready: false,
      status: "unreachable",
      error: error instanceof Error ? error.message : "Gateway tidak dapat dihubungi.",
      checkedAt,
    };
  }
}

function gatewayErrorMessage(value: unknown): string {
  const code = typeof value === "string" ? value : "gateway_error";
  switch (code) {
    case "not_ready":
    case "whatsapp_not_ready":
      return "Gateway WhatsApp belum terhubung. Buka halaman QR lalu pindai dengan WhatsApp.";
    case "unauthorized":
      return "Token gateway salah. Periksa kembali pengaturan token.";
    case "number_blacklisted":
      return "Nomor tujuan ada di daftar blacklist gateway.";
    case "required":
      return "Nomor dan pesan wajib diisi.";
    default:
      return code;
  }
}

export async function sendWhatsapp(input: SendWhatsappInput): Promise<SendWhatsappResult> {
  const settings = await getWhatsappSettings();
  if (!settings.enabled) {
    throw new AppError("INVALID_OPERATION", "Integrasi WhatsApp belum diaktifkan di Pengaturan.");
  }

  const phone = normalizeWhatsappPhone(input.to, settings.countryCode);
  if (!phone) throw new AppError("VALIDATION_ERROR", "Nomor WhatsApp tujuan tidak valid.");

  const body = input.message.trim();
  if (!body) throw new AppError("VALIDATION_ERROR", "Isi pesan WhatsApp wajib diisi.");

  const signature = settings.signature.trim();
  const finalMessage = input.withSignature === false || !signature ? body : `${body}\n\n${signature}`;

  let providerId: string | null = null;
  try {
    if (settings.provider === "FONNTE") {
      providerId = await sendViaFonnte(settings, phone, finalMessage);
    } else if (settings.provider === "CLOUD") {
      providerId = await sendViaCloud(settings, phone, finalMessage);
    } else {
      providerId = await sendViaWaha(settings, phone, finalMessage);
    }
  } catch (error) {
    throw new AppError(
      "INVALID_OPERATION",
      `Gagal mengirim WhatsApp (${settings.provider}): ${error instanceof Error ? error.message : "tidak diketahui"}`
    );
  }

  await db.insert(crmActivities).values({
    branchId: input.branchId ?? null,
    dealId: input.dealId ?? null,
    personId: input.personId ?? null,
    organizationId: input.organizationId ?? null,
    type: "WHATSAPP",
    title: input.kind === "AUTO" ? "WhatsApp otomatis terkirim" : input.kind === "BROADCAST" ? "WhatsApp broadcast terkirim" : "WhatsApp terkirim",
    notes: `Ke: +${phone}\n\n${finalMessage}${providerId ? `\n\nGateway ID: ${providerId}` : ""}`,
    completedAt: new Date(),
    ownerId: input.actorId ?? null,
    createdBy: input.actorId ?? null,
  });

  return { ok: true, id: providerId, phone, message: finalMessage };
}

export interface WhatsappBroadcastRecipient {
  phone: string;
  personId?: string | null;
}

export interface WhatsappBroadcastResult {
  ok: true;
  sent: number;
  failed: number;
  failedPhones: string[];
}

export async function sendWhatsappBroadcast(input: {
  branchId?: string | null;
  actorId: string;
  recipients: WhatsappBroadcastRecipient[];
  message: string;
}): Promise<WhatsappBroadcastResult> {
  const body = input.message.trim();
  if (!body) throw new AppError("VALIDATION_ERROR", "Isi pesan WhatsApp wajib diisi.");

  const seen = new Set<string>();
  const recipients: WhatsappBroadcastRecipient[] = [];
  for (const recipient of input.recipients) {
    const phone = (recipient.phone ?? "").trim();
    if (!phone) continue;
    const key = phone.replace(/[^0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ phone, personId: recipient.personId ?? null });
  }

  const failedPhones: string[] = [];
  for (const recipient of recipients) {
    try {
      await sendWhatsapp({
        to: recipient.phone,
        message: body,
        kind: "BROADCAST",
        actorId: input.actorId,
        branchId: input.branchId,
        personId: recipient.personId,
      });
    } catch {
      failedPhones.push(recipient.phone);
    }
  }

  return {
    ok: true,
    sent: recipients.length - failedPhones.length,
    failed: failedPhones.length,
    failedPhones,
  };
}


/** Kirim via WAHA/Baileys lokal (gateway + /send). */
async function sendViaWaha(settings: WhatsappSettings, phone: string, message: string): Promise<string | null> {
  const response = await gatewayFetch(settings, "/send", {
    method: "POST",
    body: JSON.stringify({ to: phone, message }),
  });
  let payload: { ok?: boolean; id?: string; error?: string; data?: { id?: string } } | null = null;
  try {
    payload = (await response.json()) as {
      ok?: boolean;
      id?: string;
      error?: string;
      data?: { id?: string };
    };
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(gatewayErrorMessage(payload?.error ?? "http_" + response.status));
  }
  return typeof payload?.id === "string" ? payload.id : payload?.data?.id ?? null;
}

/** Kirim via Fonnte (device token / API key dari panel fonnte). */
async function sendViaFonnte(settings: WhatsappSettings, phone: string, message: string): Promise<string | null> {
  const token = settings.fonnteToken.trim();
  if (!token) throw new Error("API key Fonnte belum diisi.");
  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token },
    body: new URLSearchParams({ target: phone, message }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { status?: boolean | string; id?: string | number; reason?: string }
    | null;
  const ok = payload?.status === true || payload?.status === "true";
  if (!response.ok || !ok) {
    throw new Error(payload?.reason ?? "http_" + response.status);
  }
  return payload?.id ? String(payload.id) : null;
}

/** Kirim via WhatsApp Cloud API resmi Meta (Graph API). */
async function sendViaCloud(settings: WhatsappSettings, phone: string, message: string): Promise<string | null> {
  const token = settings.cloudToken.trim();
  const phoneId = settings.cloudPhoneId.trim();
  if (!token || !phoneId) throw new Error("Cloud API token / Phone Number ID belum diisi.");
  const url = "https://graph.facebook.com/v22.0/" + phoneId + "/messages";
  const body = settings.cloudTemplate.trim()
    ? {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: { name: settings.cloudTemplate.trim(), language: { code: "id" } },
      }
    : {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { preview_url: false, body: message },
      };
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { messages?: Array<{ id?: string }>; error?: { message?: string } }
    | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message ?? "http_" + response.status);
  }
  return payload?.messages?.[0]?.id ?? null;
}

interface WhatsappContext {
  deal: typeof crmDeals.$inferSelect | null;
  person: typeof crmPeople.$inferSelect | null;
  organization: typeof crmOrganizations.$inferSelect | null;
  stage: typeof crmStages.$inferSelect | null;
}

async function loadWhatsappContext(input: { dealId?: string | null; personId?: string | null }): Promise<WhatsappContext> {
  if (input.dealId) {
    const rows = await db
      .select({
        deal: crmDeals,
        person: crmPeople,
        organization: crmOrganizations,
        stage: crmStages,
      })
      .from(crmDeals)
      .leftJoin(crmPeople, eq(crmDeals.personId, crmPeople.id))
      .leftJoin(crmOrganizations, eq(crmDeals.organizationId, crmOrganizations.id))
      .innerJoin(crmStages, eq(crmDeals.stageId, crmStages.id))
      .where(and(eq(crmDeals.id, input.dealId), isNull(crmDeals.deletedAt)))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  if (input.personId) {
    const rows = await db
      .select({
        person: crmPeople,
        organization: crmOrganizations,
      })
      .from(crmPeople)
      .leftJoin(crmOrganizations, eq(crmPeople.organizationId, crmOrganizations.id))
      .where(and(eq(crmPeople.id, input.personId), isNull(crmPeople.deletedAt)))
      .limit(1);
    if (rows[0]) return { deal: null, person: rows[0].person, organization: rows[0].organization, stage: null };
  }

  return { deal: null, person: null, organization: null, stage: null };
}

function templateVariables(context: WhatsappContext): Record<string, string> {
  return {
    nama: context.person?.name ?? "Bapak/Ibu",
    sapaan: context.person?.name ?? "Bapak/Ibu",
    nomor: context.person?.whatsapp?.trim() || context.person?.phone?.trim() || "",
    perusahaan: context.organization?.name ?? process.env.NEXT_PUBLIC_APP_NAME ?? "Madani Aqiqah",
    kota: context.person?.city ?? "",
    produk: context.deal?.productInterest ?? "aqiqah",
    nilai: context.deal ? formatIDR(context.deal.value) : "",
    tahap: context.stage?.name ?? "",
    judul: context.deal?.title ?? "",
    tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  };
}

export async function buildWhatsappTemplates(input: {
  dealId?: string | null;
  personId?: string | null;
}): Promise<WhatsappTemplate[]> {
  const settings = await getWhatsappSettings();
  const context = await loadWhatsappContext(input);
  const variables = templateVariables(context);

  return [
    { key: "manual", label: "Pesan umum", body: renderWhatsappTemplate(settings.templateManual, variables) },
    { key: "new_deal", label: "Sapaan deal baru", body: renderWhatsappTemplate(settings.templateNewDeal, variables) },
    { key: "stage_change", label: "Update tahap", body: renderWhatsappTemplate(settings.templateStageChange, variables) },
  ].filter((template) => template.body.length > 0);
}

export async function sendAutoWhatsappForDeal(input: {
  dealId: string;
  trigger: AutoWhatsappTrigger;
  actorId?: string | null;
  stageId?: string | null;
}): Promise<{ sent: boolean; skipped?: string }> {
  const settings = await getWhatsappSettings();
  if (!settings.enabled || !settings.autoEnabled) return { sent: false, skipped: "disabled" };

  if (input.trigger === "DEAL_CREATED" && !settings.autoOnCreate) {
    return { sent: false, skipped: "auto_create_disabled" };
  }
  if (input.trigger === "STAGE_CHANGED") {
    if (!settings.autoOnStageChange) return { sent: false, skipped: "auto_stage_disabled" };
    if (settings.autoStageId && settings.autoStageId !== input.stageId) {
      return { sent: false, skipped: "stage_not_selected" };
    }
  }

  const context = await loadWhatsappContext({ dealId: input.dealId });
  if (!context.deal) return { sent: false, skipped: "deal_not_found" };
  if (!context.person) return { sent: false, skipped: "no_contact" };

  const phone = context.person.whatsapp?.trim() || context.person.phone?.trim() || "";
  if (!phone) return { sent: false, skipped: "no_phone" };

  const template =
    input.trigger === "DEAL_CREATED" ? settings.templateNewDeal : settings.templateStageChange;
  if (!template.trim()) return { sent: false, skipped: "no_template" };

  const message = renderWhatsappTemplate(template, templateVariables(context));

  try {
    await sendWhatsapp({
      to: phone,
      message,
      kind: "AUTO",
      dealId: context.deal.id,
      personId: context.person.id,
      organizationId: context.deal.organizationId,
      branchId: context.deal.branchId,
      actorId: input.actorId ?? null,
    });
    return { sent: true };
  } catch (error) {
    console.error("[whatsapp] gagal kirim otomatis", error);
    return { sent: false, skipped: error instanceof Error ? error.message : "failed" };
  }
}

export async function saveWhatsappSettings(
  values: Record<string, unknown>,
  actor: AuthUser
): Promise<void> {
  const { updateSettings } = await import("@/server/services/settings");
  const allowed = new Set<string>(WHATSAPP_SETTING_KEY_LIST);
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    clean[key] = typeof value === "string" ? value : value == null ? "" : String(value);
  }

  const gatewayUrl = clean[WHATSAPP_SETTING_KEYS.gatewayUrl];
  if (typeof gatewayUrl === "string" && gatewayUrl.trim()) {
    try {
      const parsed = new URL(gatewayUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
      clean[WHATSAPP_SETTING_KEYS.gatewayUrl] = gatewayUrl.trim().replace(/\/+$/, "");
    } catch {
      throw new AppError("VALIDATION_ERROR", "URL gateway harus berupa http:// atau https:// yang valid.");
    }
  }

  const countryCode = clean[WHATSAPP_SETTING_KEYS.countryCode];
  if (typeof countryCode === "string" && countryCode.trim()) {
    clean[WHATSAPP_SETTING_KEYS.countryCode] = countryCode.replace(/\D/g, "") || "62";
  }

  await updateSettings(clean, actor);
}

/** ── Manajemen API Key tersimpan (Fonnte / Cloud resmi / WAHA) ── */

export function maskWaToken(token: string): string {
  const t = token.trim();
  if (t.length <= 4) return "••••";
  return "••••" + t.slice(-4);
}

export async function listWaKeys(): Promise<
  Array<{
    id: string;
    provider: "FONNTE" | "CLOUD" | "WAHA";
    label: string;
    tokenMasked: string;
    phoneId: string | null;
    note: string | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  const rows = await db.select().from(waApiKeys).orderBy(desc(waApiKeys.createdAt));
  return rows.map((r) => ({
    id: r.id,
    provider: (r.provider === "CLOUD" || r.provider === "WAHA" ? r.provider : "FONNTE") as "FONNTE",
    label: r.label,
    tokenMasked: maskWaToken(r.token),
    phoneId: r.phoneId,
    note: r.note,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createWaKey(
  input: { provider: string; label: string; token: string; phoneId?: string; note?: string },
  actorId: string | null
): Promise<string> {
  const provider = input.provider.toUpperCase() === "CLOUD" ? "CLOUD" : input.provider.toUpperCase() === "WAHA" ? "WAHA" : "FONNTE";
  const [row] = await db
    .insert(waApiKeys)
    .values({
      provider,
      label: input.label.trim() || (provider === "FONNTE" ? "Fonnte" : provider === "CLOUD" ? "Cloud API" : "WAHA"),
      token: input.token.trim(),
      phoneId: provider === "CLOUD" ? input.phoneId?.replace(/[^0-9]/g, "") || null : null,
      note: input.note?.trim() || null,
      createdBy: actorId,
    })
    .returning({ id: waApiKeys.id });
  return row.id;
}

export async function deleteWaKey(id: string): Promise<void> {
  await db.delete(waApiKeys).where(eq(waApiKeys.id, id));
}

/** Aktifkan key: tulis token ke pengaturan sesuai provider. */
export async function activateWaKey(id: string, actor: AuthUser): Promise<void> {
  const [row] = await db.select().from(waApiKeys).where(eq(waApiKeys.id, id)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", "API key tidak ditemukan.");
  const provider = row.provider === "CLOUD" ? "CLOUD" : row.provider === "WAHA" ? "WAHA" : "FONNTE";
  const updates: Record<string, unknown> = { provider };
  if (provider === "FONNTE") updates[WHATSAPP_SETTING_KEYS.fonnteToken] = row.token;
  if (provider === "CLOUD") {
    updates[WHATSAPP_SETTING_KEYS.cloudToken] = row.token;
    if (row.phoneId) updates[WHATSAPP_SETTING_KEYS.cloudPhoneId] = row.phoneId;
  }
  if (provider === "WAHA") {
    updates[WHATSAPP_SETTING_KEYS.apiToken] = row.token;
  }
  await db.update(waApiKeys).set({ isActive: true }).where(eq(waApiKeys.id, row.id));
  await db.update(waApiKeys).set({ isActive: false }).where(ne(waApiKeys.id, row.id));
  await saveWhatsappSettings(updates, actor);
}

// ===== Inbox WhatsApp (gateway lokal) =====

export interface InboxChat {
  jid: string;
  number: string;
  name: string;
  isGroup: boolean;
  unread: number;
  archived: boolean;
  pinned: boolean;
  lastMessageAt: number;
  lastMessage: string;
  lastType: string;
  lastDirection: "in" | "out";
  lastStatus: string | null;
}

export interface InboxMedia {
  url?: string | null;
  mimetype?: string;
  size?: number;
  fileName?: string;
  voice?: boolean;
  historical?: boolean;
}

export interface InboxMessage {
  id: string;
  jid: string;
  waId: string | null;
  number: string;
  direction: "in" | "out";
  fromMe: boolean;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
  text: string;
  media: InboxMedia | null;
  status: string | null;
  timestamp: number;
  pushName: string;
  createdAt: string;
}

export interface InboxSummary {
  ok: true;
  chats: number;
  unread: number;
  ready: boolean;
  status: string;
  me: { id?: string | null; name?: string | null } | null;
}

function assertInboxProvider(settings: WhatsappSettings): void {
  if (settings.provider !== "WAHA") {
    throw new AppError("INVALID_OPERATION", "Inbox hanya tersedia dengan provider WAHA/gateway lokal.");
  }
  if (!settings.gatewayUrl.trim()) {
    throw new AppError("INVALID_OPERATION", "URL gateway WhatsApp belum diisi.");
  }
}

async function gatewayJson<T>(
  settings: WhatsappSettings,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await gatewayFetch(settings, path, init);
  const payload = (await response.json().catch(() => null)) as
    | (T & { ok?: boolean; error?: string })
    | null;
  if (!response.ok || payload?.ok === false) {
    throw new AppError(
      "INVALID_OPERATION",
      gatewayErrorMessage(payload?.error ?? `http_${response.status}`)
    );
  }
  return payload as T;
}

export async function getInboxSummary(): Promise<InboxSummary> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  return gatewayJson<InboxSummary>(settings, "/inbox/summary");
}

export async function listInboxChats(
  opts: { limit?: number; search?: string; filter?: "unread" | "all" } = {}
): Promise<InboxChat[]> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.search) params.set("search", opts.search);
  if (opts.filter === "unread") params.set("filter", "unread");
  const suffix = params.toString();
  const data = await gatewayJson<{ ok: true; chats: InboxChat[] }>(
    settings,
    `/chats${suffix ? `?${suffix}` : ""}`
  );
  return data.chats ?? [];
}

export async function listInboxMessages(
  jid: string,
  opts: { limit?: number; before?: number } = {}
): Promise<{ messages: InboxMessage[]; hasMore: boolean; name: string }> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", String(opts.before));
  const suffix = params.toString();
  const data = await gatewayJson<{
    ok: true;
    messages: InboxMessage[];
    hasMore: boolean;
    name: string;
  }>(settings, `/chats/${encodeURIComponent(jid)}/messages${suffix ? `?${suffix}` : ""}`);
  return { messages: data.messages ?? [], hasMore: Boolean(data.hasMore), name: data.name ?? jid };
}

export async function markInboxRead(jid: string): Promise<void> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  await gatewayJson(settings, `/chats/${encodeURIComponent(jid)}/read`, {
    method: "POST",
    body: "{}",
  });
}

export async function sendInboxMedia(input: {
  to: string;
  buffer: Buffer;
  mimetype: string;
  fileName?: string;
  caption?: string;
}): Promise<{ id: string | null; url: string | null; type: string }> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  const phone = normalizeWhatsappPhone(input.to, settings.countryCode);
  if (!phone) throw new AppError("VALIDATION_ERROR", "Nomor WhatsApp tujuan tidak valid.");
  if (input.buffer.length > 10 * 1024 * 1024) {
    throw new AppError("VALIDATION_ERROR", "Lampiran maksimal 10 MB.");
  }
  const data = await gatewayJson<{ ok: true; id?: string; url?: string; type?: string }>(
    settings,
    "/send/media",
    {
      method: "POST",
      body: JSON.stringify({
        to: phone,
        dataBase64: input.buffer.toString("base64"),
        mimetype: input.mimetype,
        fileName: input.fileName ?? "lampiran",
        caption: input.caption ?? "",
      }),
    }
  );
  return { id: data.id ?? null, url: data.url ?? null, type: data.type ?? "document" };
}

export async function getInboxMedia(
  file: string
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const settings = await getWhatsappSettings();
  assertInboxProvider(settings);
  const headers: Record<string, string> = {};
  if (settings.apiToken.trim()) headers.Authorization = `Bearer ${settings.apiToken.trim()}`;
  const response = await fetch(joinUrl(settings.gatewayUrl, `/media/${encodeURIComponent(file)}`), {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AppError("NOT_FOUND", "Media WhatsApp tidak ditemukan.");
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
