import { requirePageUser } from "@/lib/server/page-auth";
import { SettingsShell } from "@/components/system/settings-shell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <SettingsShell permissions={user.permissions}>{children}</SettingsShell>;
}
