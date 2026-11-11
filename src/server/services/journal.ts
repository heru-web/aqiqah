import "server-only";
import { assertBranchAccess } from "@/lib/branch-access";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, journalLines, journals } from "@/db/schema";
import { periodClosings } from "@/db/schema/erp-extensions";
import { InvalidOperationError, NotFoundError } from "@/lib/errors";
import { insertAudit, type Tx } from "@/lib/server/audit";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";

/* Kode akun default (COA di-seed; kode sistem tetap dijaga). */
export const COA = {
  EXPENSE_PAYROLL: "5-1210",
  EMPLOYEE_RECEIVABLE: "1-1320",
  AR: "1-1310", // Piutang Usaha
  CASH: "1-1101", // Kas Kecil
  BANK: "1-1120", // Kas di Bank
  INVENTORY: "1-1400", // Persediaan
  INCOME_SALES: "4-1110", // Pendapatan Usaha
  INCOME_OTHER: "4-2100", // Pendapatan Lain
  HPP: "5-1410", // Harga Pokok Produksi
  EXPENSE_GENERAL: "5-1200", // Beban Umum
  PAYABLE: "2-1300", // Hutang Usaha
  EQUITY: "3-1100", // Modal
} as const;

export interface JournalLineInput {
  accountCode: string;
  debit: bigint;
  credit: bigint;
  description?: string;
  referenceType?: string;
}

export interface PostJournalInput {
  exec: Tx | typeof db;
  branchId: string | null;
  type: (typeof journals.$inferSelect)["type"];
  journalDate: Date;
  description: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  lines: JournalLineInput[];
  actor: AuthUser;
}

export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "");
}

/**
 * Post jurnal. Menjamin: ≥2 baris, debit == credit, akun dikenal & postable.
 */
export async function postJournal(input: PostJournalInput): Promise<string> {
  if (input.exec === db) return db.transaction((tx) => postJournal({ ...input, exec: tx }));
  assertBranchAccess(input.actor, input.branchId);
  if (input.lines.some((line) => line.debit < 0n || line.credit < 0n || (line.debit > 0n && line.credit > 0n))) throw new InvalidOperationError("Baris jurnal harus memuat debit atau kredit non-negatif, bukan keduanya.");
  const { exec, branchId, type, journalDate, description, sourceModule, sourceEntityType, sourceEntityId, lines, actor } = input;

  const wib = new Date(journalDate.getTime() + 7 * 3600e3);
  const period = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
  const closedRows = await exec
    .select({ period: periodClosings.period })
    .from(periodClosings)
    .where(eq(periodClosings.period, period));
  if (closedRows.length > 0) {
    throw new InvalidOperationError(`Periode ${period} telah ditutup — posting jurnal manual ditolak.`);
  }

  const valid = lines.filter((l) => l.debit > 0n || l.credit > 0n);
  if (valid.length < 2) throw new InvalidOperationError("Jurnal harus memiliki minimal 2 baris.");

  let debitTotal = 0n;
  let creditTotal = 0n;
  for (const l of valid) {
    if (l.debit < 0n || l.credit < 0n) throw new InvalidOperationError("Debit/kredit tidak boleh negatif.");
    debitTotal += l.debit;
    creditTotal += l.credit;
  }
  if (debitTotal !== creditTotal) {
    throw new InvalidOperationError(`Jurnal tidak balance: debit ${debitTotal} ≠ kredit ${creditTotal}`, {
      debit: debitTotal.toString(),
      credit: creditTotal.toString(),
    });
  }

  const journalNumber = await nextSequentialNumber("JNL", { pad: 6 }, exec);
  const [journal] = await exec
    .insert(journals)
    .values({
      journalNumber,
      branchId,
      journalDate,
      type,
      status: "POSTED",
      description,
      sourceModule,
      sourceEntityType,
      sourceEntityId,
      debitTotal,
      creditTotal,
      postedBy: actor.id,
      postedAt: new Date(),
    })
    .returning();

  for (const l of valid) {
    const account = await exec
      .select({ id: accounts.id, code: accounts.code, isPostable: accounts.isPostable, isActive: accounts.isActive })
      .from(accounts)
      .where(eq(accounts.code, normalizeCode(l.accountCode)))
      .limit(1);
    if (account.length === 0) throw new NotFoundError(`Akun COA tidak dikenal: ${l.accountCode}`);
    if (!account[0].isPostable) throw new InvalidOperationError(`Akun header tidak boleh dipost: ${l.accountCode}`);
    if (!account[0].isActive) throw new InvalidOperationError(`Akun nonaktif: ${l.accountCode}`);

    await exec.insert(journalLines).values({
      journalId: journal.id,
      accountId: account[0].id,
      debit: l.debit,
      credit: l.credit,
      description: l.description ?? null,
      referenceType: l.referenceType ?? null,
    });
  }

  await insertAudit(exec, {
    actor,
    action: "POST",
    module: "accounting",
    entityType: "journal",
    entityId: journal.id,
    after: {
      type,
      debitTotal: debitTotal.toString(),
      creditTotal: creditTotal.toString(),
      lines: valid.map((l) => ({ accountCode: l.accountCode, debit: l.debit.toString(), credit: l.credit.toString() })),
    },
  });

  return journal.id;
}

/** Reversal — jurnal lawan + tandai original REVERSED (immutable). */
export async function reverseJournal(exec: Tx | typeof db, journalId: string, actor: AuthUser, reason?: string): Promise<string> {
  if (exec === db) return db.transaction((tx) => reverseJournal(tx, journalId, actor, reason));
  const wib = new Date(Date.now() + 7 * 3600e3);
  const period = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
  const closedRows = await exec
    .select({ period: periodClosings.period })
    .from(periodClosings)
    .where(eq(periodClosings.period, period));
  if (closedRows.length > 0) {
    throw new InvalidOperationError(`Periode ${period} telah ditutup — reversal ditolak.`);
  }

  const existing = await exec.select().from(journals).where(eq(journals.id, journalId)).limit(1).for("update");
  if (existing.length === 0) throw new NotFoundError("Jurnal tidak ditemukan.");
  const src = existing[0];
  assertBranchAccess(actor, src.branchId);
  if (src.status !== "POSTED") throw new InvalidOperationError("Hanya jurnal POSTED yang bisa di-reverse.");

  const lines = await exec.select().from(journalLines).where(eq(journalLines.journalId, journalId));

  const revNumber = await nextSequentialNumber("JNL", { pad: 6 }, exec);
  const [rev] = await exec
    .insert(journals)
    .values({
      journalNumber: revNumber,
      branchId: src.branchId,
      journalDate: new Date(),
      type: "REVERSAL",
      status: "POSTED",
      description: `Reversal ${src.journalNumber}${reason ? ` — ${reason}` : ""}`,
      sourceModule: src.sourceModule,
      sourceEntityType: src.sourceEntityType,
      sourceEntityId: src.sourceEntityId,
      debitTotal: src.creditTotal,
      creditTotal: src.debitTotal,
      reversalOfId: src.id,
      postedBy: actor.id,
      postedAt: new Date(),
    })
    .returning({ id: journals.id });

  for (const l of lines) {
    const acc = await exec.select().from(accounts).where(eq(accounts.id, l.accountId)).limit(1);
    if (acc.length === 0) throw new NotFoundError("Akun tidak ditemukan.");
    await exec.insert(journalLines).values({
      journalId: rev.id,
      accountId: acc[0].id,
      debit: l.credit,
      credit: l.debit,
      description: l.description ? `REVERSAL: ${l.description}` : null,
      referenceType: l.referenceType,
    });
  }

  await exec.update(journals).set({ status: "REVERSED", reversedBy: actor.id, reversedAt: new Date() }).where(eq(journals.id, src.id));

  await insertAudit(exec, {
    actor,
    action: "REVERSE",
    module: "accounting",
    entityType: "journal",
    entityId: src.id,
    after: { reversalId: rev.id, reason },
  });

  return rev.id;
}