import { AppShell } from '@/components/app/app-shell';
import { requirePageUser } from '@/lib/server/page-auth';
import { getUserMenuOverrides } from '@/server/services/users';
import { getAllowedMenuHrefs } from '@/components/app/nav';
import { countUnread, listInbox } from '@/server/services/notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [inbox, unread, menuOverrides] = await Promise.all([
    listInbox(user),
    countUnread(user),
    getUserMenuOverrides(),
  ]);

  const customMenus = menuOverrides[user.id] ?? null;
  const roleMenus = getAllowedMenuHrefs(user.permissions);
  const allowedMenus =
    Array.isArray(customMenus) && customMenus.length > 0
      ? customMenus.filter((href) => roleMenus.includes(href)).includes("/dashboard")
        ? customMenus.filter((href) => roleMenus.includes(href))
        : ["/dashboard", ...customMenus.filter((href) => roleMenus.includes(href))]
      : roleMenus;

  return <AppShell user={user} inbox={inbox} unread={unread} allowedMenus={allowedMenus}>{children}</AppShell>;
}
