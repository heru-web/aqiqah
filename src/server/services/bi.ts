import "server-only";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, journalLines, journals, orderItems, orders } from "@/db/schema";
import { monthKeys, monthLabel, monthStart } from "@/lib/bi-period";

export interface FinanceTrendPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
}

/** Tren pendapatan/beban/laba per bulan dari jurnal terposting. */
export async function monthlyFinanceTrend(
  branchId?: string | null,
  months = 12
): Promise<FinanceTrendPoint[]> {
  const keys = monthKeys(months, new Date());
  const from = monthStart(keys[0]);

  const rows = await db
    .select({
      month: sql<string>`to_char(${journals.journalDate} at time zone 'Asia/Jakarta', 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${accounts.type} = 'INCOME' then ${journalLines.credit} - ${journalLines.debit} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${accounts.type} = 'EXPENSE' then ${journalLines.debit} - ${journalLines.credit} else 0 end), 0)`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journals.status, "POSTED"),
        gte(journals.journalDate, from),
        branchId ? eq(journals.branchId, branchId) : undefined
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return keys.map((key) => {
    const row = byMonth.get(key);
    const income = row ? Number(row.income) : 0;
    const expense = row ? Number(row.expense) : 0;
    return { month: key, label: monthLabel(key), income, expense, profit: income - expense };
  });
}

export interface TopProductRow {
  description: string;
  qty: number;
  revenue: string;
}

/** Produk/paket terlaris berdasarkan nilai baris pesanan (tanpa draft & batal). */
export async function topProducts(opts: {
  branchId?: string | null;
  from: Date;
  to: Date;
  limit?: number;
}): Promise<TopProductRow[]> {
  const rows = await db
    .select({
      description: orderItems.description,
      qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        gte(orders.createdAt, opts.from),
        lte(orders.createdAt, opts.to),
        notInArray(orders.status, ["DRAFT", "CANCELLED"] as (typeof orders.$inferSelect)["status"][]),
        opts.branchId ? eq(orders.branchId, opts.branchId) : undefined
      )
    )
    .groupBy(orderItems.description)
    .orderBy(sql`coalesce(sum(${orderItems.lineTotal}), 0) desc`)
    .limit(opts.limit ?? 8);

  return rows.map((r) => ({ description: r.description, qty: Number(r.qty), revenue: r.revenue }));
}
