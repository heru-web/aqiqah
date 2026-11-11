import { z } from "zod";

/**
 * Registry skema untuk semua kunci `app_settings`.
 * Tujuan: kunci tak dikenal ditolak, tipe & panjang divalidasi, dan nilai
 * dinormalisasi (trim/uppercase) sebelum disimpan.
 */

const text = (max: number) => z.string().trim().max(max);
const boolStr = z.enum(["true", "false"], { message: "Nilai harus true/false." });

export const SETTINGS_SCHEMA = {
  "company.name": text(120).min(2, "Nama usaha minimal 2 karakter."),
  "company.tagline": text(160),
  "currency.code": z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z]{3}$/, "Kode mata uang harus 3 huruf, contoh IDR.")),
  "delivery.defaultNote": text(500),

  "whatsapp.provider": z.enum(["WAHA", "FONNTE", "CLOUD"], { message: "Provider tidak dikenal." }),
  "whatsapp.enabled": boolStr,
  "whatsapp.gatewayUrl": z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/.test(v), "URL gateway harus http:// atau https://."),
  "whatsapp.apiToken": text(300),
  "whatsapp.deviceLabel": text(80),
  "whatsapp.countryCode": z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Kode negara harus 1-4 angka, contoh 62."),
  "whatsapp.signature": text(300),
  "whatsapp.autoEnabled": boolStr,
  "whatsapp.autoOnCreate": boolStr,
  "whatsapp.autoOnStageChange": boolStr,
  "whatsapp.autoStageId": text(64),
  "whatsapp.templateNewDeal": text(2000),
  "whatsapp.templateStageChange": text(2000),
  "whatsapp.templateManual": text(2000),
  "whatsapp.fonnteToken": text(300),
  "whatsapp.cloudToken": text(1000),
  "whatsapp.cloudPhoneId": z.string().trim().regex(/^\d*$/, "Phone Number ID harus angka."),
  "whatsapp.cloudTemplate": text(80),
  "whatsapp.alarmSuperadminPhone": text(32),
} satisfies Record<string, z.ZodTypeAny>;

export type SettingsKey = keyof typeof SETTINGS_SCHEMA;

export function isKnownSettingsKey(key: string): key is SettingsKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key);
}

export function validateSettingValue(
  key: string,
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (!isKnownSettingsKey(key)) return { ok: false, error: `Kunci pengaturan tidak dikenal: ${key}` };
  const parsed = SETTINGS_SCHEMA[key].safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: `${key}: ${parsed.error.issues[0]?.message ?? "nilai tidak valid"}` };
  }
  return { ok: true, value: parsed.data as string };
}
