/** Konstanta & helper WhatsApp yang aman dipakai di server maupun client. */

export type WhatsappProvider = "WAHA" | "FONNTE" | "CLOUD";

export const WHATSAPP_PROVIDERS: Array<{ value: WhatsappProvider; label: string; hint: string }> = [
  {
    value: "WAHA",
    label: "WAHA lokal (Baileys)",
    hint: "Gateway send-hosted di server ini — scan QR sekali, tanpa biaya.",
  },
  {
    value: "FONNTE",
    label: "Fonnte",
    hint: "API key dari device Fonnte (fonnte.com) — mudah, tanpa server.",
  },
  {
    value: "CLOUD",
    label: "WhatsApp Cloud API (resmi Meta)",
    hint: "Paling aman dari risiko ban. Butuh access token + Phone Number ID & template disetujui.",
  },
];

export const WHATSAPP_SETTING_KEYS = {
  provider: "whatsapp.provider",
  enabled: "whatsapp.enabled",
  gatewayUrl: "whatsapp.gatewayUrl",
  apiToken: "whatsapp.apiToken",
  deviceLabel: "whatsapp.deviceLabel",
  countryCode: "whatsapp.countryCode",
  signature: "whatsapp.signature",
  autoEnabled: "whatsapp.autoEnabled",
  autoOnCreate: "whatsapp.autoOnCreate",
  autoOnStageChange: "whatsapp.autoOnStageChange",
  autoStageId: "whatsapp.autoStageId",
  templateNewDeal: "whatsapp.templateNewDeal",
  templateStageChange: "whatsapp.templateStageChange",
  templateManual: "whatsapp.templateManual",
  fonnteToken: "whatsapp.fonnteToken",
  cloudToken: "whatsapp.cloudToken",
  cloudPhoneId: "whatsapp.cloudPhoneId",
  cloudTemplate: "whatsapp.cloudTemplate",
  alarmSuperadminPhone: "whatsapp.alarmSuperadminPhone",
} as const;

export const WHATSAPP_SETTING_KEY_LIST = Object.values(WHATSAPP_SETTING_KEYS);

export interface WhatsappSettings {
  provider: WhatsappProvider;
  enabled: boolean;
  gatewayUrl: string;
  apiToken: string;
  deviceLabel: string;
  countryCode: string;
  signature: string;
  autoEnabled: boolean;
  autoOnCreate: boolean;
  autoOnStageChange: boolean;
  autoStageId: string;
  templateNewDeal: string;
  templateStageChange: string;
  templateManual: string;
  fonnteToken: string;
  cloudToken: string;
  cloudPhoneId: string;
  cloudTemplate: string;
  alarmSuperadminPhone: string;
}

export interface WhatsappGatewayStatus {
  reachable: boolean;
  ready: boolean;
  status: string;
  engine?: string | null;
  me?: { id?: string | null; name?: string | null } | null;
  error?: string | null;
  checkedAt: string;
}

export interface WhatsappTemplate {
  key: string;
  label: string;
  body: string;
}

export function normalizeWhatsappPhone(value: string | null | undefined, countryCode = "62"): string {
  const raw = String(value ?? "").replace(/\D/g, "");
  if (!raw) return "";

  const cc = String(countryCode ?? "62").replace(/\D/g, "") || "62";
  let normalized = raw;
  if (raw.startsWith("00")) normalized = raw.slice(2);
  else if (raw.startsWith(cc)) normalized = raw;
  else if (raw.startsWith("0")) normalized = `${cc}${raw.slice(1)}`;
  else if (raw.startsWith("8")) normalized = `${cc}${raw}`;

  return normalized.length >= 8 && normalized.length <= 15 ? normalized : "";
}

export function renderWhatsappTemplate(
  template: string,
  variables: Record<string, string | number | bigint | null | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return result.replace(/\{\w+\}/g, "").trim();
}
