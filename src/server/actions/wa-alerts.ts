"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import {
  ALERT_RULE_META,
  listRules,
  updateRule,
  runRuleNow,
  listRecentLogs,
} from "@/server/services/wa-alerts";

export type WaAlarmFormState = { error?: string; message?: string } | undefined;

export async function saveWaAlarmRuleAction(fd: FormData): Promise<WaAlarmFormState> {
  try {
    await requirePermission("settings.settings.update");
    const id = String(fd.get("id") ?? "").trim();
    if (!id) return { error: "ID aturan tidak valid." };
    const hour = Number(fd.get("hour") ?? 20);
    const minute = Number(fd.get("minute") ?? 0);
    const phones = String(fd.get("phones") ?? "")
      .split(/[,\n;]+/)
      .map((p) => p.replace(/\D/g, ""))
      .filter((p) => p.length >= 8)
      .join(",");
    await updateRule(id, {
      enabled: fd.get("enabled") === "on" || fd.get("enabled") === "true",
      sendHour: Number.isFinite(hour) ? hour : 20,
      sendMinute: Number.isFinite(minute) ? minute : 0,
      targetRoles: String(fd.get("targetRoles") ?? "SUPERADM"),
      onlyWeekdays: fd.get("onlyWeekdays") === "on" || fd.get("onlyWeekdays") === "true",
      template: String(fd.get("template") ?? ""),
    });
    revalidatePath("/settings/alarm");
    revalidatePath("/alarm");
    revalidatePath("/settings/whatsapp");
    return { message: "Aturan alarm disimpan." };
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan aturan alarm." };
  }
}

export async function testWaAlarmAction(ruleId: string, code: string): Promise<WaAlarmFormState> {
  try {
    const actor = await requirePermission("settings.settings.action");
    if (!ALERT_RULE_META[code]) return { error: "Aturan tidak dikenal." };
    const res = await runRuleNow(code, [actor.id], { force: true });
    if (res.skipped === "disabled") return { error: "Aturan dalam keadaan nonaktif." };
    if (res.skipped === "empty") return { message: "Tidak ada yang perlu dilaporkan saat ini — tidak ada pesan terkirim." };
    return { message: `Alarm terkirim ke ${res.targetCount ?? 0} penerima.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menjalankan alarm." };
  }
}
