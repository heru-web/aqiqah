import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountOpenings } from "@/db/schema/erp-extensions";
import { accounts, branches } from "@/db/schema";
import { ConflictError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export interface OpeningEntry {
  accountId: string;
  code: string;
  name: string;
  opening: bigint;
}

export async function listBranchesSimple(): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name));
}

export async function listAccountsWithOpenings(branchId: string): Promise<OpeningEntry[]> {
  const [accs, openings] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.code)),
    db.select().from(accountOpenings).where(eq(accountOpenings.branchId, branchId)),
  ]);
  const map = new Map(openings.map((o) => [o.accountId, o.opening]));
  return accs.map((a) => ({
    accountId: a.id,
    code: a.code,
    name: a.name,
    opening: map.get(a.id) ?? 0n,
  }));
}

/** Simpan saldo awal per cabang (bulk). Hanya akun yang nilainya berubah yang di-upsert. */
export async function saveAccountOpenings(
  branchId: string,
  entries: Array<{ accountId: string; opening: bigint }>,
  actor: AuthUser
): Promise<number> {
  const before = await db.select().from(accountOpenings).where(eq(accountOpenings.branchId, branchId));
  const beforeMap = new Map(before.map((b) => [b.accountId, b.opening]));

  const dup = new Set<string>();
  let changed = 0;
  for (const e of entries) {
    if (dup.has(e.accountId)) throw new ConflictError("Ada akun duplikat pada input.");
    dup.add(e.accountId);
    const prev = beforeMap.get(e.accountId);
    if (prev !== undefined && prev === e.opening) continue;
    await db
      .insert(accountOpenings)
      .values({ branchId, accountId: e.accountId, opening: e.opening, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: [accountOpenings.branchId, accountOpenings.accountId],
        set: { opening: e.opening, updatedBy: actor.id },
      });
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: "accounting",
      entityType: "account_opening",
      entityId: e.accountId,
      before: { branchId, opening: prev !== undefined ? prev.toString() : null },
      after: { branchId, opening: e.opening.toString() },
    });
    changed += 1;
  }
  return changed;
}
