import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, rolePermissions, roles, sessions, userRoles, users } from "@/db/schema";
import { NAV_GROUPS } from "@/components/app/nav";
import { ConflictError, InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import { hashPassword } from "@/lib/server/auth";
import type { AuthUser } from "@/lib/server/auth";
import { isKnownPermission } from "@/lib/permissions";
import { userCreateSchema, userUpdateSchema } from "@/server/schemas";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(input: { branchId?: string; email: string; name: string; password: string; phone?: string; roleIds: string[] }, actor: AuthUser): Promise<string> {
  const parsed = userCreateSchema.parse(input);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.email.toLowerCase())).limit(1);
  if (existing.length > 0) throw new ConflictError("Email sudah terdaftar.");

  const passwordHash = await hashPassword(parsed.password);
  const branchId = parsed.branchId ?? actor.branchId;

  const [user] = await db
    .insert(users)
    .values({
      branchId,
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      passwordHash,
      phone: parsed.phone ?? null,
    })
    .returning({ id: users.id });

  for (const roleId of parsed.roleIds) {
    await db.insert(userRoles).values({ userId: user.id, roleId });
  }

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "users",
    entityType: "user",
    entityId: user.id,
    after: { email: parsed.email, name: parsed.name, roleIds: parsed.roleIds },
  });
  return user.id;
}

export async function updateUser(id: string, input: { name?: string; phone?: string; isActive?: boolean; roleIds?: string[] }, actor: AuthUser): Promise<string> {
  const parsed = userUpdateSchema.parse(input);
  const before = await requireUser(id);

  const setFields: Record<string, unknown> = {};
  if (parsed.name !== undefined) setFields.name = parsed.name;
  if (parsed.phone !== undefined) setFields.phone = parsed.phone;
  if (parsed.isActive !== undefined) setFields.isActive = parsed.isActive;

  if (Object.keys(setFields).length > 0) {
    await db.update(users).set(setFields).where(eq(users.id, id));
  }

  if (parsed.roleIds) {
    const roleIds = parsed.roleIds;
    const current = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id));
    const currentIds = current.map((r) => r.roleId);
    const toAdd = roleIds.filter((r) => !currentIds.includes(r));
    const toRemove = currentIds.filter((r) => !roleIds.includes(r));
    if (toAdd.length) {
      for (const roleId of toAdd) await db.insert(userRoles).values({ userId: id, roleId });
    }
    if (toRemove.length) {
      await db.delete(userRoles).where(and(eq(userRoles.userId, id), inArray(userRoles.roleId, toRemove)));
    }
  }

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "users",
    entityType: "user",
    entityId: id,
    before: { name: before.name, isActive: before.isActive },
    after: { name: parsed.name ?? before.name, roleIds: parsed.roleIds ?? undefined },
  });
  return id;
}

/** Ubah identitas akun: nama + email login. Email dipakai untuk login. */
export async function updateUserProfile(
  id: string,
  input: { name: string; email: string },
  actor: AuthUser
): Promise<string> {
  const before = await requireUser(id);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 3) throw new InvalidOperationError("Nama minimal 3 karakter.");
  if (!EMAIL_RE.test(email)) throw new InvalidOperationError("Format email tidak valid.");

  const emailOwner = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (emailOwner.length > 0 && emailOwner[0].id !== id) throw new ConflictError("Email sudah terdaftar.");

  await db.update(users).set({ name, email }).where(eq(users.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "users",
    entityType: "user",
    entityId: id,
    before: { name: before.name, email: before.email },
    after: { name, email },
  });
  return id;
}

/** Reset password oleh pengurus: user bisa langsung login dengan password baru. */
export async function resetUserPassword(id: string, password: string, actor: AuthUser): Promise<string> {
  const before = await requireUser(id);
  if (password.length < 8) throw new InvalidOperationError("Kata sandi minimal 8 karakter.");
  const passwordHash = await hashPassword(password);

  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  // Cabut semua sesi aktif user ini agar password lama langsung tidak berlaku.
  await db.delete(sessions).where(eq(sessions.userId, id));

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "users",
    entityType: "user",
    entityId: id,
    before: { name: before.name },
    after: { passwordReset: true },
  });
  return id;
}

/** Hapus pengguna: diarsipkan soft-delete (deletedAt) + nonaktif, agar riwayat transaksi tetap utuh. */
export async function deleteUser(id: string, actor: AuthUser): Promise<string> {
  const before = await requireUser(id);
  if (before.email === actor.email) throw new InvalidOperationError("Tidak bisa menghapus akun sendiri.");

  await db.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id));

  await insertAudit(db, {
    actor,
    action: "DELETE",
    module: "users",
    entityType: "user",
    entityId: id,
    before: { name: before.name, email: before.email },
  });
  return id;
}

export async function listUsers(opts: { branchId?: string; page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 50 } = opts;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      branchId: users.branchId,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(opts.branchId ? eq(users.branchId, opts.branchId) : undefined, isNull(users.deletedAt)))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const usersWithRoles = await Promise.all(
    rows.map(async (u) => ({
      ...u,
      roleIds: (await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, u.id))).map((r) => r.roleId),
    }))
  );
  return usersWithRoles;
}

export async function requireUser(id: string) {
  const row = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Pengguna tidak ditemukan.");
  return row[0];
}

/* ----------------------------------- Roles ---------------------------------- */

export async function createRole(input: { name: string; slug: string; description?: string; permissions: string[] }, actor: AuthUser): Promise<string> {
  const roleIds = await db.select({ id: roles.id, slug: roles.slug }).from(roles);
  void roleIds;
  const dup = await db.select({ id: roles.id }).from(roles).where(eq(roles.slug, input.slug)).limit(1);
  if (dup.length > 0) throw new ConflictError("Slug role sudah dipakai.");

  const invalid = input.permissions.filter((p) => !isKnownPermission(p) && p !== "*");
  if (invalid.length > 0) throw new InvalidOperationError(`Permission tidak dikenal: ${invalid.join(", ")}`);

  const [role] = await db.insert(roles).values({ name: input.name, slug: input.slug, description: input.description ?? null }).returning({ id: roles.id });
  for (const perm of input.permissions) {
    await db.insert(rolePermissions).values({ roleId: role.id, permission: perm });
  }
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "roles",
    entityType: "role",
    entityId: role.id,
    after: { name: input.name, permissions: input.permissions },
  });
  return role.id;
}

export async function updateRole(id: string, input: { name?: string; description?: string; permissions?: string[] }, actor: AuthUser): Promise<string> {
  const before = await requireRole(id);
  if (before.isSystem && input.permissions) {
    throw new InvalidOperationError(`Role sistem '${before.name}' tidak bisa diubah izinnya.`);
  }
  if (input.name) await db.update(roles).set({ name: input.name, description: input.description }).where(eq(roles.id, id));

  if (input.permissions) {
    const invalid = input.permissions.filter((p) => !isKnownPermission(p) && p !== "*");
    if (invalid.length > 0) throw new InvalidOperationError(`Permission tidak dikenal: ${invalid.join(", ")}`);
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    for (const perm of input.permissions) await db.insert(rolePermissions).values({ roleId: id, permission: perm });
  }

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "roles",
    entityType: "role",
    entityId: id,
    before: { name: before.name },
    after: { name: input.name ?? before.name },
  });
  return id;
}

export async function listRoles() {
  const rows = await db.select().from(roles).orderBy(roles.name);
  const withPerms = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      permissions: (await db.select({ permission: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, r.id))).map((p) => p.permission),
    }))
  );
  return withPerms;
}

export async function requireRole(id: string) {
  const row = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Role tidak ditemukan.");
  return row[0];
}

/* ============================================================
 * Hak Akses Menu User (izin khusus menu per pengguna)
 * ============================================================ */

export const USER_MENU_OVERRIDES_KEY = "user_menu_overrides";

export interface MenuPermission {
  custom: boolean;
  menus: string[] | null;
}

export function getNavMenuOptions(): { href: string; label: string; group: string }[] {
  return NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.group })));
}

async function readMenuOverrides(): Promise<Record<string, string[] | null>> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, USER_MENU_OVERRIDES_KEY)).limit(1);
  if (rows.length === 0) return {};
  const value = rows[0].value;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string[] | null>) : {};
}

export async function getUserMenuOverrides(): Promise<Record<string, string[] | null>> {
  return readMenuOverrides();
}

export async function getUserMenuPermission(userId: string): Promise<MenuPermission> {
  const overrides = await readMenuOverrides();
  const menus = overrides[userId] ?? null;
  return Array.isArray(menus) && menus.length > 0 ? { custom: true, menus } : { custom: false, menus: null };
}

export async function saveUserMenuPermission(userId: string | undefined, menus: string[] | null, actor: AuthUser): Promise<void> {
  if (!userId) throw new InvalidOperationError("Pengguna tidak dikenal.");
  await requireUser(userId);

  const validHrefs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
  const requested = menus ?? null;

  const overrides = await readMenuOverrides();

  if (requested === null) {
    delete overrides[userId];
    await db
      .insert(appSettings)
      .values({ key: USER_MENU_OVERRIDES_KEY, value: overrides })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: overrides } });
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: "users",
      entityType: "user",
      entityId: userId,
      before: { menuAndalan: true, customMenus: true },
      after: { menuMode: "default" },
    });
    return;
  }

  const cleaned = Array.from(new Set(requested.filter((h) => validHrefs.has(h))));
  if (!cleaned.includes("/dashboard")) cleaned.unshift("/dashboard");
  if (cleaned.length > 0) {
    overrides[userId] = cleaned;
    await db
      .insert(appSettings)
      .values({ key: USER_MENU_OVERRIDES_KEY, value: overrides })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: overrides } });
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: "users",
      entityType: "user",
      entityId: userId,
      before: { menuMode: "default" },
      after: { menuMode: "custom", menus: cleaned },
    });
  }
}


/** Simpan/ubah avatar user (URL storage, boleh null untuk hapus). */
export async function updateUserAvatar(id: string, avatarKey: string | null, actor: AuthUser): Promise<void> {
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) throw new NotFoundError("Pengguna tidak ditemukan.");
  const avatarUrl = avatarKey ? "/storage/" + avatarKey : null;
  await db.update(users).set({ avatarUrl }).where(eq(users.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "users",
    entityType: "user",
    entityId: id,
    before: { avatarUrl: before.avatarUrl },
    after: { avatarUrl },
  });
}
