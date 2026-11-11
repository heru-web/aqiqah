import { PageHeader } from "@/components/app/page-header";
import { WhatsappSettingsForm } from "@/components/system/whatsapp-settings-form";
import { requirePagePermission } from "@/lib/server/page-auth";
import { ensureDefaultPipeline } from "@/server/services/crm";
import { getWhatsappSettings, getWhatsappStatus, listWaKeys } from "@/server/services/whatsapp";

export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requirePagePermission("settings.settings.view");
  const { tab } = await searchParams;
  const [{ stages }, settings, status, waKeys] = await Promise.all([
    ensureDefaultPipeline(user.branchId ?? undefined),
    getWhatsappSettings(),
    getWhatsappStatus(),
    listWaKeys().catch(() => []),
  ]);

  return (
    <div>
      <PageHeader
        title="WhatsApp Gateway"
        description="Koneksi, pesan, otomatisasi, dan API key pengirim WhatsApp. Alarm panel ada di menu Alarm Notifikasi."
        actions={null}
      />
      <WhatsappSettingsForm
        initial={settings}
        initialStatus={status}
        stages={stages.map((stage) => ({ id: stage.id, name: stage.name }))}
        initialTab={tab}
        waKeys={waKeys.map((k) => ({
          id: k.id,
          provider: k.provider,
          label: k.label,
          tokenMasked: k.tokenMasked,
          phoneId: k.phoneId,
          note: k.note,
          isActive: k.isActive,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
