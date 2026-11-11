import { redirect } from "next/navigation";
import { getAuth, type AuthUser } from "@/lib/server/auth";
import { can } from "@/lib/permissions";

/** Guard halaman server: redirect ke /login bila belum login. */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await getAuth();
  if (!user) redirect("/login");
  if (!user.branchId && !user.permissions.includes("*")) redirect("/forbidden");
  return user;
}

/**
 * Guard halaman server dengan permission.
 * Redirect ke /login bila belum login, ke /dashboard bila tidak berizin.
 */
export async function requirePagePermission(permission: string): Promise<AuthUser> {
  const user = await requirePageUser();
  if (!can(user.permissions, permission)) redirect("/forbidden");
  return user;
}
