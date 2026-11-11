import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, auditLogs, branches } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import { branchCreateSchema } from "@/server/schemas";
import { validateSettingValue } from "@/lib/settings-schema";

/* --------------------------------- Branches -------------------------------- */

export async function createBranch(input: { code: string; name: string; ownerName?: string; address?: string; city?: string; phone?: string; email?: string; igHandle?: string }, actor: AuthUser): Promise<string> {
  const parsed = branchCreateSchema.parse(input);
  const dup = await db.select({ id: branches.id }).from(branches).where(eq(branches.code, parsed.code)).limit(1);
  if (dup.length > 0) throw new ConflictError("Kode cabang sudah dipakai.");

  const [row] = await db
    .insert(branches)
    .values({
      code: parsed.code,
      name: parsed.name,
      ownerName: parsed.ownerName ?? null,
      address: parsed.address ?? null,
      city: parsed.city ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email || null,
      igHandle: parsed.igHandle ?? null,
    })
    .returning({ id: branches.id });

  await insertAudit(db, { actor, action: "CREATE", module: "branches", entityType: "branch", entityId: row.id, after: { ...parsed } });
  return row.id;
}

export async function listBranches() {
  return db.select().from(branches).where(eq(branches.isActive, true)).orderBy(branches.name);
}

export async function updateBranch(id: string, input: Partial<{ name: string; ownerName: string; address: string; city: string; phone: string; email: string; igHandle: string; isActive: boolean }>, actor: AuthUser): Promise<string> {
  const row = await db.update(branches).set(input).where(eq(branches.id, id)).returning({ id: branches.id });
  if (row.length === 0) throw new NotFoundError("Cabang tidak ditemukan.");
  await insertAudit(db, { actor, action: "UPDATE", module: "branches", entityType: "branch", entityId: id, after: input });
  return row[0].id;
}

/* --------------------------------- Settings -------------------------------- */

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function updateSettings(input: Record<string, unknown>, actor: AuthUser): Promise<void> {
  if (Object.keys(input).length === 0) return;

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const result = validateSettingValue(key, value);
    if (!result.ok) throw new ValidationError(result.error);
    clean[key] = result.value;
  }

  for (const [key, value] of Object.entries(clean)) {
    await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }
  await insertAudit(db, { actor, action: "UPDATE", module: "settings", entityType: "settings", after: clean });
}

/* ---------------------------------- Audit ---------------------------------- */

export async function listAuditLogs(opts: { module?: string; page?: number; pageSize?: number } = {}) {
  const { module, page = 1, pageSize = 50 } = opts;
  const rows = await db
    .select()
    .from(auditLogs)
    .where(module ? eq(auditLogs.module, module) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return rows;
}