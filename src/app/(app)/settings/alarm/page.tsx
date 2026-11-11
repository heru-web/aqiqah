import { PageHeader } from "@/components/app/page-header";
import { AlarmModule } from "@/components/system/alarm-module";
import { listRules, listRecentLogs } from "@/server/services/wa-alerts";
import { requirePagePermission } from "@/lib/server/page-auth";

export const dynamic = "force-dynamic";

export default async function AlarmPage() {
  await requirePagePermission("settings.settings.view");
  const [rules, logs] = await Promise.all([listRules(), listRecentLogs().catch(() => [])]);

  return (
    <div>
      <PageHeader
        title="Alarm Notifikasi"
        description="Setiap harinya atur siapa dikirim pemberitahuan: laporan belum diisi, target belum tercapai, follow-up terlambat, dan stok menipis — tersimpan di lonceng panel atas."
        actions={null}
      />
      <AlarmModule
        rules={rules.map((rule) => ({
          id: rule.id,
          code: rule.code,
          label: rule.label,
          desc: rule.desc,
          enabled: rule.enabled,
          sendHour: rule.sendHour,
          sendMinute: rule.sendMinute,
          targetRoles: rule.targetRoles,
          onlyWeekdays: rule.onlyWeekdays,
          template: rule.template,
          lastSentAt: rule.lastSentAt ? new Date(rule.lastSentAt).toISOString() : null,
        }))}
        logs={logs}
      />
    </div>
  );
}
