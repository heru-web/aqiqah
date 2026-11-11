import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, journalLines, journals } from "@/db/schema";
import { accountOpenings } from "@/db/schema/erp-extensions";

export const POSTED = eq(journals.status, "POSTED");

type Bal = { code: string; name: string; type: string; opening: bigint; cumulative: bigint; period: bigint };

function nz(v: unknown): bigint {
  return v === null || v === undefined ? 0n : BigInt(String(v));
}

/** Balance tiap akun: opening + kumulatif (hingga `to`) + perubahan dalam periode [from, to]. */
export async function accountBalances(from: Date, to: Date, branchId?: string | null): Promise<Bal[]> {
  const openingRows = branchId
    ? await db.select({ accountId: accountOpenings.accountId, opening: accountOpenings.opening }).from(accountOpenings).where(eq(accountOpenings.branchId, branchId))
    : [];
  const openingMap = new Map(openingRows.map((o) => [o.accountId, o.opening]));
  const [rows, accs] = await Promise.all([
    db
      .select({
        accountId: journalLines.accountId,
        cumDebit: sql<string>`sum(${journalLines.debit})`,
        cumCredit: sql<string>`sum(${journalLines.credit})`,
        perDebit: sql<string>`coalesce(sum(case when ${journals.journalDate} >= ${from.toISOString()} then ${journalLines.debit} else 0 end), 0)`,
        perCredit: sql<string>`coalesce(sum(case when ${journals.journalDate} >= ${from.toISOString()} then ${journalLines.credit} else 0 end), 0)`,
      })
      .from(journalLines)
      .innerJoin(journals, eq(journalLines.journalId, journals.id))
      .where(
        and(
          POSTED,
          sql`${journals.journalDate} <= ${to.toISOString()}`,
          branchId ? eq(journals.branchId, branchId) : undefined
        )
      )
      .groupBy(journalLines.accountId),
    db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.code)),
  ]);

  const byId = new Map(rows.map((r) => [r.accountId, r]));
  const out: Bal[] = [];
  for (const a of accs) {
    const agg = byId.get(a.id);
    const cumD = agg ? nz(agg.cumDebit) : 0n;
    const cumC = agg ? nz(agg.cumCredit) : 0n;
    const perD = agg ? nz(agg.perDebit) : 0n;
    const perC = agg ? nz(agg.perCredit) : 0n;
    const opening = branchId ? (openingMap.get(a.id) ?? 0n) : nz(a.openingBalance);
    out.push({
      code: a.code,
      name: a.name,
      type: a.type,
      opening,
      cumulative: opening + cumD - cumC,
      period: perD - perC,
    });
  }
  return out;
}

export async function generalLedger(from: Date, to: Date, branchId?: string | null, limit = 400) {
  const lines = await db
    .select({
      id: journalLines.id,
      journalNumber: journals.journalNumber,
      journalDate: journals.journalDate,
      description: journals.description,
      status: journals.status,
      accountCode: accounts.code,
      accountName: accounts.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        POSTED,
        sql`${journals.journalDate} >= ${from.toISOString()}`,
        sql`${journals.journalDate} <= ${to.toISOString()}`,
        branchId ? eq(journals.branchId, branchId) : undefined
      )
    )
    .orderBy(asc(journals.journalDate), asc(journals.journalNumber))
    .limit(limit);
  return lines;
}

/** Pergerakan akun kas & bank (kode 1-11xx) — basis arus kas sederhana. */
export async function cashFlow(from: Date, to: Date, branchId?: string | null) {
  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        POSTED,
        sql`${journals.journalDate} >= ${from.toISOString()}`,
        sql`${journals.journalDate} <= ${to.toISOString()}`,
        sql`${accounts.code} like '1-11%'`,
        branchId ? eq(journals.branchId, branchId) : undefined
      )
    )
    .groupBy(accounts.id)
    .orderBy(asc(accounts.code));
  return rows.map((r) => ({ ...r, net: nz(r.debit) - nz(r.credit) }));
}

/** Segmen arus kas sederhana (OPERASI/INVESTASI/PENDANAAN) — klasifikasi otomatis
    dari akun lawan jurnal kas (transfer kas-ke-kas internal tidak dihitung). */
export async function cashFlowSegments(from: Date, to: Date, branchId?: string | null) {
  const result = await db.execute(sql`
    WITH cash AS (
      SELECT j.id AS journal_id, SUM(jl.debit) AS masuk, SUM(jl.credit) AS keluar,
        COALESCE((
          SELECT CASE
            WHEN pa.code LIKE '3-%' THEN 'PENDANAAN'
            WHEN pa.code LIKE '2-2%' THEN 'PENDANAAN'
            WHEN pa.code LIKE '1-2%' THEN 'INVESTASI'
            ELSE 'OPERASI'
          END
          FROM journal_lines p
          JOIN accounts pa ON pa.id = p.account_id
          WHERE p.journal_id = j.id AND pa.code NOT LIKE '1-11%' AND (p.debit <> 0 OR p.credit <> 0)
          ORDER BY CASE
            WHEN pa.code LIKE '3-%' THEN 0
            WHEN pa.code LIKE '2-2%' THEN 1
            WHEN pa.code LIKE '1-2%' THEN 2
            ELSE 3
          END
          LIMIT 1
        ), 'OPERASI') AS segment
      FROM journals j
      JOIN journal_lines jl ON jl.journal_id = j.id
      JOIN accounts a ON a.id = jl.account_id
      WHERE j.status = 'POSTED'
        AND j.journal_date >= ${from.toISOString()}
        AND j.journal_date <= ${to.toISOString()}
        AND a.code LIKE '1-11%'
        ${branchId ? sql`AND j.branch_id = ${branchId}` : sql``}
        AND EXISTS (
          SELECT 1 FROM journal_lines p
          JOIN accounts pa ON pa.id = p.account_id
          WHERE p.journal_id = j.id AND pa.code NOT LIKE '1-11%' AND (p.debit <> 0 OR p.credit <> 0)
        )
      GROUP BY j.id
    )
    SELECT segment, SUM(masuk) AS masuk, SUM(keluar) AS keluar FROM cash GROUP BY segment
  `);
  const rows = (result as unknown as { rows?: Array<{ segment: string; masuk: string; keluar: string }> }).rows ?? (result as unknown as Array<{ segment: string; masuk: string; keluar: string }>);
  const map = new Map(rows.map((r) => [r.segment, r]));
  return (["OPERASI", "INVESTASI", "PENDANAAN"] as const).map((segment) => ({
    segment,
    masuk: nz(map.get(segment)?.masuk),
    keluar: nz(map.get(segment)?.keluar),
    net: nz(map.get(segment)?.masuk) - nz(map.get(segment)?.keluar),
  }));
}
