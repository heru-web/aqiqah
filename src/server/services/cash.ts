import "server-only";
import { branchWhere } from "@/lib/server/resource-access";
import { resolveBranch } from "@/lib/branch-access";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cashAccounts } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export async function listCashAccounts(actor: AuthUser) {
  return db.select().from(cashAccounts).where(branchWhere(actor, cashAccounts.branchId)).orderBy(asc(cashAccounts.name));
}

export async function createCashAccount(
  input: {
    branchId?: string | null;
    name: string;
    type: "BANK" | "CASH" | "EWALLET" | "VA";
    bankName?: string | null;
    accountNumber?: string | null;
    openingBalance?: bigint;
    isActive?: boolean;
  },
  actor: AuthUser
) {
  const [row] = await db
    .insert(cashAccounts)
    .values({
      branchId: resolveBranch(actor, input.branchId),
      name: input.name,
      type: input.type,
      bankName: input.bankName ?? null,
      accountNumber: input.accountNumber ?? null,
      openingBalance: input.openingBalance ?? 0n,
      isActive: input.isActive ?? true,
    })
    .returning({ id: cashAccounts.id });

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "cash",
    entityType: "cash_account",
    entityId: row.id,
    after: { ...input, openingBalance: input.openingBalance?.toString() },
  });
  return row.id;
}

export async function updateCashAccount(
  id: string,
  input: Partial<{
    name: string;
    bankName: string | null;
    accountNumber: string | null;
    isActive: boolean;
  }>,
  actor: AuthUser
) {
  const row = await db.update(cashAccounts).set(input).where(eq(cashAccounts.id, id)).returning({ id: cashAccounts.id });
  if (row.length === 0) throw new NotFoundError("Akun kas/bank tidak ditemukan.");
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "cash",
    entityType: "cash_account",
    entityId: id,
    after: input,
  });
  return row[0].id;
}
