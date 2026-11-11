"use server";
import { imageFormat } from "@/lib/image-upload";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { createUser, deleteUser, getUserMenuPermission, resetUserPassword, saveUserMenuPermission, updateUser, updateUserProfile } from "@/server/services/users";
import { InvalidOperationError } from "@/lib/errors";

function message(err: unknown, fallback: string): string {
  return AppError.is(err) ? err.message : fallback;
}

/** Ubah nama + email login pengguna. */
export async function updateUserProfileAction(
  userId: string,
  input: { name: string; email: string }
): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    await updateUserProfile(userId, input, actor);
  } catch (err) {
    return { error: message(err, "Gagal memperbarui akun.") };
  }
  revalidatePath("/users");
  return {};
}

/** Reset password pengguna; semua sesi lama dicabut. */
export async function resetUserPasswordAction(
  userId: string,
  password: string
): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    await resetUserPassword(userId, password, actor);
  } catch (err) {
    return { error: message(err, "Gagal mereset password.") };
  }
  revalidatePath("/users");
  return {};
}

/** Hapus (arsipkan) pengguna: hilang dari daftar, riwayat transaksi tetap aman. */
export async function deleteUserAction(userId: string): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.delete");
  try {
    await deleteUser(userId, actor);
  } catch (err) {
    return { error: message(err, "Gagal menghapus pengguna.") };
  }
  revalidatePath("/users");
  return {};
}

/** Ubah role utama pengguna (satu role per akun). */
export async function setUserSingleRoleAction(
  userId: string,
  roleId: string
): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    if (!roleId) throw new InvalidOperationError("Role wajib dipilih.");
    await updateUser(userId, { roleIds: [roleId] }, actor);
  } catch (err) {
    return { error: message(err, "Gagal mengubah role.") };
  }
  revalidatePath("/users");
  return {};
}

/** Baca izin khusus menu pengguna. */
export async function getUserMenuPermissionAction(
  userId: string
): Promise<{ error?: string; custom?: boolean; menus?: string[] | null }> {
  await requirePermission("users.users.view");
  try {
    const perm = await getUserMenuPermission(userId);
    return { custom: perm.custom, menus: perm.menus };
  } catch (err) {
    return { error: message(err, "Gagal membaca izin menu.") };
  }
}

/** Simpan izin khusus menu pengguna (null = kembali mengikuti standar role). */
export async function saveUserMenuPermissionAction(
  userId: string,
  menus: string[] | null
): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  try {
    if (!actor.roles.includes("superadmin")) {
      throw new InvalidOperationError("Hanya Super Admin yang boleh mengatur izin menu.");
    }
    await saveUserMenuPermission(userId, menus, actor);
  } catch (err) {
    return { error: message(err, "Gagal menyimpan izin menu.") };
  }
  revalidatePath("/", "layout");
  return {};
}


/** Unggah avatar pengguna (FormData: userId + file). */
export async function updateUserAvatarAction(
  fd: FormData
): Promise<{ error?: string }> {
  const actor = await requirePermission("users.users.update");
  const userId = String(fd.get("userId") ?? "");
  const file = fd.get("file");
  if (!userId) return { error: "userId wajib diisi." };
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih file foto." };
  if (file.size > 2 * 1024 * 1024) return { error: "Ukuran maksimal 2 MB." };
  if (!/image\/(jpeg|png|webp)/.test(file.type)) return { error: "Format harus JPEG/PNG/WebP." };

  try {
    const { getStorage, objectKey } = await import("@/lib/server/storage");
    const buf = Buffer.from(await file.arrayBuffer());
    const format = imageFormat(buf);
    const key = objectKey("avatar", `foto.${format.extension}`);
    await getStorage().put(key, buf, format.mime);
    const { updateUserAvatar } = await import("@/server/services/users");
    await updateUserAvatar(userId, key, actor);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengunggah avatar." };
  }
  revalidatePath("/users");
  revalidatePath("/dashboard");
  return {};
}
