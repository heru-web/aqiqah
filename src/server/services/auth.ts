import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import { createSession, verifyPassword } from "@/lib/server/auth";

export interface LoginResult {
  userId: string;
  token: string;
  cookie: Record<string, unknown>;
}

export async function loginWithEmailAndPassword(
  email: string,
  password: string,
  ctx: { ip?: string; userAgent?: string }
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) throw new AppError("VALIDATION_ERROR", "Email dan kata sandi wajib diisi.");

  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (rows.length === 0) {
    throw new AppError("UNAUTHENTICATED", "Email atau kata sandi salah.");
  }
  const user = rows[0];
  if (!user.isActive) throw new AppError("UNAUTHENTICATED", "Akun dinonaktifkan.");
  if (user.deletedAt) throw new AppError("UNAUTHENTICATED", "Akun tidak ditemukan.");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await insertAudit(db, {
      actor: { id: user.id, email: user.email, name: user.name, branchId: user.branchId, roles: [], permissions: [] },
      action: "LOGIN",
      module: "auth",
      entityType: "user",
      entityId: user.id,
      metadata: { success: false, ip: ctx.ip },
    });
    throw new AppError("UNAUTHENTICATED", "Email atau kata sandi salah.");
  }

  const session = await createSession(user.id, ctx);
  await insertAudit(db, {
    actor: { id: user.id, email: user.email, name: user.name, branchId: user.branchId, roles: [], permissions: [] },
    action: "LOGIN",
    module: "auth",
    entityType: "user",
    entityId: user.id,
    metadata: { success: true, ip: ctx.ip },
  });

  return { userId: user.id, token: session.token, cookie: session.cookie };
}