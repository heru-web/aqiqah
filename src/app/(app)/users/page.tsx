import { listBranches } from "@/server/services/settings";
import { getNavMenuOptions, listRoles, listUsers } from "@/server/services/users";
import { requirePagePermission } from "@/lib/server/page-auth";
import { UserManagement, type UserRowData } from "@/components/app/user-management";

export default async function UsersPage() {
  const user = await requirePagePermission("users.users.view");
  const [rows, roles, branches] = await Promise.all([
    listUsers({ branchId: user.branchId ?? undefined, page: 1, pageSize: 500 }),
    listRoles(),
    listBranches(),
  ]);

  const users: UserRowData[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    branchId: u.branchId,
    avatarUrl: u.avatarUrl,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
    roleIds: u.roleIds,
  }));

  const isSuper = user.roles.includes("superadmin");

  return (
    <UserManagement
      users={users}
      roles={roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      menuOptions={getNavMenuOptions()}
      currentUserId={user.id}
      currentUserIsSuper={isSuper}
    />
  );
}
