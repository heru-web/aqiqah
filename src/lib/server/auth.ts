import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { db } from "@/db";
import {
  branches,
  rolePermissions,
  roles,
  sessions,
  userRoles,
  users,
} from "@/db/schema";
import { AppError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { can } from "@/lib/permissions";

const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "ma3_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 14);
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  branchId: string | null;
  avatarUrl?: string | null;
  roles: string[];
  permissions: string[];
}

export interface SessionInfo {
  tokenHash: string;
  expiresAt: Date;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Kata sandi minimal 8 karakter.");
  }
  return argonHash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

export async function createSession(
  userId: string,
  ctx: { ip?: string; userAgent?: string }
): Promise<{ token: string; cookie: Record<string, unknown>; session: SessionInfo }> {
  const token = newSessionToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
    expiresAt,
  });
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
  const cookie = {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
  return { token, cookie, session: { tokenHash, expiresAt } };
}

export function hasPermission(permissions: string[], required: string): boolean {
  return can(permissions, required);
}

async function loadUserByToken(token: string): Promise<AuthUser | null> {
  const tokenHash = sha256Hex(token);
  const row = await db
    .select({
      user: users,
      session: sessions,
      roleSlug: roles.slug,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (row.length === 0) return null;
  const { user, session } = row[0];
  if (!user.isActive || user.deletedAt || session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  const roleIds = (
    await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, user.id))
  ).map((r) => r.roleId);

  const roleSlugs = (
    await db.select({ slug: roles.slug }).from(roles).where(inArray(roles.id, roleIds))
  ).map((r) => r.slug);

  const perms = (await db.select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds))).map((p) => p.permission);

  // pemeliharaan sesi aktif
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, session.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    branchId: user.branchId,
    avatarUrl: user.avatarUrl ?? null,
    roles: roleSlugs,
    permissions: perms,
  };
}

/** Ambil sesi aktif dari cookie — dipanggil `await` di server action / RSC. */
export const getAuth = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadUserByToken(token);
});

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuth();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (!hasPermission(user.permissions, permission)) {
    throw new ForbiddenError(`Perlu izin: ${permission}`);
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = sha256Hex(token);
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
    store.delete(SESSION_COOKIE);
  }
}

export async function defaultBranchId(): Promise<string | null> {
  const active = await db.select({ id: branches.id }).from(branches).where(eq(branches.isActive, true)).limit(1);
  return active[0]?.id ?? null;
}

export function cookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}