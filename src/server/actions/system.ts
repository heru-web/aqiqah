"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import {
  createBranch,
  updateSettings,
} from "@/server/services/settings";
import { createRole, createUser, updateRole, updateUser } from "@/server/services/users";
import { isKnownPermission } from "@/lib/permissions";

export type SystemState = { error?: string; success?: boolean } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : fallback;
}

function message(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

/* --------------------------------- Users ---------------------------------- */

export async function createUserAction(_prev: SystemState, fd: FormData): Promise<SystemState> {
  const actor = await requirePermission("users.users.create");
  const roleIds = fd.getAll("roleIds").map(String);
  try {
    await createUser(
      {
        email: field(fd, "email"),
        name: field(fd, "name"),
        password: field(fd, "password"),
        phone: field(fd, "phone") || undefined,
        roleIds,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal membuat pengguna.") };
  }
  revalidatePath("/users");
  return { success: true };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    await updateUser(userId, { isActive }, actor);
    revalidatePath("/users");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal mengubah status pengguna.") };
  }
}

export async function setUserRolesAction(userId: string, roleIds: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    await updateUser(userId, { roleIds }, actor);
    revalidatePath("/users");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal memperbarui role.") };
  }
}

/* ---------------------------------- Roles --------------------------------- */

export async function createRoleAction(_prev: SystemState, fd: FormData): Promise<SystemState> {
  const actor = await requirePermission("roles.roles.create");
  const permissions = fd.getAll("permissions").map(String).filter(isKnownPermission);
  try {
    await createRole(
      {
        name: field(fd, "name"),
        slug: field(fd, "slug"),
        description: field(fd, "description") || undefined,
        permissions,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal membuat role.") };
  }
  revalidatePath("/roles");
  return { success: true };
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissions: string[]
): Promise<{ error?: string }> {
  const actor = await requirePermission("roles.roles.update");
  try {
    await updateRole(roleId, { permissions }, actor);
    revalidatePath("/roles");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal memperbarui permission.") };
  }
}

/* -------------------------------- Branches --------------------------------- */

export async function createBranchAction(_prev: SystemState, fd: FormData): Promise<SystemState> {
  const actor = await requirePermission("branches.branches.create");
  try {
    await createBranch(
      {
        code: field(fd, "code"),
        name: field(fd, "name"),
        ownerName: field(fd, "ownerName") || undefined,
        address: field(fd, "address") || undefined,
        city: field(fd, "city") || undefined,
        phone: field(fd, "phone") || undefined,
        email: field(fd, "email") || undefined,
        igHandle: field(fd, "igHandle") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: message(err, "Gagal membuat cabang.") };
  }
  revalidatePath("/branches");
  return { success: true };
}

/* -------------------------------- Settings --------------------------------- */

export async function saveSettingsAction(values: Record<string, unknown>): Promise<{ error?: string }> {
  const actor = await requirePermission("settings.settings.update");
  try {
    await updateSettings(values, actor);
    revalidatePath("/settings");
    return {};
  } catch (err) {
    return { error: message(err, "Gagal menyimpan pengaturan.") };
  }
}