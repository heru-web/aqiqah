import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/system/settings-form";
import { getSettings } from "@/server/services/settings";
import { requirePagePermission } from "@/lib/server/page-auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePagePermission("settings.settings.view");
  const settings = await getSettings();

  return (
    <div>
      <PageHeader
        title="Identitas Usaha"
        description="Nama usaha, tagline, mata uang, dan catatan pengiriman default."
        actions={null}
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
