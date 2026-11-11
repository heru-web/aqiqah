import { describe, expect, it } from "vitest";
import { isKnownSettingsKey, validateSettingValue } from "@/lib/settings-schema";

describe("Registry skema app_settings", () => {
  it("menolak kunci yang tidak terdaftar", () => {
    expect(isKnownSettingsKey("company.name")).toBe(true);
    expect(isKnownSettingsKey("company.secret")).toBe(false);
    const res = validateSettingValue("company.secret", "x");
    expect(res.ok).toBe(false);
  });

  it("menormalisasi kode mata uang ke huruf besar", () => {
    const res = validateSettingValue("currency.code", "idr");
    expect(res).toEqual({ ok: true, value: "IDR" });
  });

  it("menolak nama usaha terlalu pendek", () => {
    expect(validateSettingValue("company.name", "A").ok).toBe(false);
    expect(validateSettingValue("company.name", "Aqiqah Madani")).toEqual({
      ok: true,
      value: "Aqiqah Madani",
    });
  });

  it("memvalidasi provider, boolean string, dan URL gateway", () => {
    expect(validateSettingValue("whatsapp.provider", "FONNTE")).toEqual({ ok: true, value: "FONNTE" });
    expect(validateSettingValue("whatsapp.provider", "SMS").ok).toBe(false);
    expect(validateSettingValue("whatsapp.enabled", "true")).toEqual({ ok: true, value: "true" });
    expect(validateSettingValue("whatsapp.enabled", "ya").ok).toBe(false);
    expect(validateSettingValue("whatsapp.gatewayUrl", "http://127.0.0.1:3015").ok).toBe(true);
    expect(validateSettingValue("whatsapp.gatewayUrl", "ftp://x").ok).toBe(false);
    expect(validateSettingValue("whatsapp.gatewayUrl", "").ok).toBe(true);
  });

  it("memvalidasi kode negara dan phone id", () => {
    expect(validateSettingValue("whatsapp.countryCode", "62")).toEqual({ ok: true, value: "62" });
    expect(validateSettingValue("whatsapp.countryCode", "abc").ok).toBe(false);
    expect(validateSettingValue("whatsapp.cloudPhoneId", "12345").ok).toBe(true);
    expect(validateSettingValue("whatsapp.cloudPhoneId", "12a").ok).toBe(false);
  });
});
