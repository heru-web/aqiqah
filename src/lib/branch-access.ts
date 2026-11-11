import type { AuthUser } from "@/lib/server/auth";
import { ForbiddenError } from "@/lib/errors";

/** A missing branch is not permission to access every branch. */
export function assertBranchAccess(actor: AuthUser, branchId: string | null): void {
  if (actor.branchId === null && actor.permissions.includes("*")) return;
  if (!actor.branchId || actor.branchId !== branchId) {
    throw new ForbiddenError("Data tidak tersedia untuk cabang Anda.");
  }
}

export function resolveBranch(actor: AuthUser, requested?: string | null): string {
  const branchId = requested ?? actor.branchId;
  if (!branchId) throw new ForbiddenError("Pilih cabang sebelum membuat transaksi.");
  assertBranchAccess(actor, branchId);
  return branchId;
}
