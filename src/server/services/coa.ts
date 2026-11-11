import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, accountType } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export async function listAccounts() {
  return db.select().from(accounts).orderBy(asc(accounts.code));
}

export async function createAccount(
  input: {
    code: string;
    name: string;
    type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
    group?: string | null;
    description?: string | null;
    parentId?: string | null;
    isPostable?: boolean;
    isActive?: boolean;
    isSystem?: boolean;
    openingBalance?: bigint;
  },
  actor: AuthUser
) {
  const dup = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, input.code)).limit(1);
  if (dup.length > 0) throw new ConflictError("Kode akun sudah digunakan.");
  const [row] = await db
    .insert(accounts)
    .values({
      code: input.code,
      name: input.name,
      type: input.type,
      group: input.group ?? null,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      isPostable: input.isPostable ?? true,
      isActive: input.isActive ?? true,
      isSystem: input.isSystem ?? false,
      openingBalance: input.openingBalance ?? 0n,
    })
    .returning({ id: accounts.id });

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "accounting",
    entityType: "account",
    entityId: row.id,
    after: { ...input, openingBalance: input.openingBalance?.toString() },
  });
  return row.id;
}

export async function updateAccount(
  id: string,
  input: Partial<{
    name: string;
    group: string | null;
    description: string | null;
    parentId: string | null;
    isPostable: boolean;
    isActive: boolean;
  }>,
  actor: AuthUser
) {
  const row = await db.update(accounts).set(input).where(eq(accounts.id, id)).returning({ id: accounts.id });
  if (row.length === 0) throw new NotFoundError("Akun tidak ditemukan.");
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "accounting",
    entityType: "account",
    entityId: id,
    after: input,
  });
  return row[0].id;
}

export async function toggleAccount(id: string, isActive: boolean, actor: AuthUser) {
  const row = await db
    .update(accounts)
    .set({ isActive })
    .where(eq(accounts.id, id))
    .returning({ id: accounts.id, isSystem: accounts.isSystem });
  if (row.length === 0) throw new NotFoundError("Akun tidak ditemukan.");
  if (row[0].isSystem) throw new ConflictError("Akun sistem tidak boleh dinonaktifkan.");
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "accounting",
    entityType: "account",
    entityId: id,
  });
  return row[0].id;
}
