import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { receivables } from "@/db/schema/sales";
import { customers } from "@/db/schema/crm";

export type ReceivableStatus = "OPEN" | "PARTIAL" | "BAD_DEBT" | "SETTLED";
export const RECEIVABLE_STATUSES: ReceivableStatus[] = ["OPEN", "PARTIAL", "BAD_DEBT", "SETTLED"];

export interface ReceivableFilter {
  branchId?: string | null;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceivableView {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  amount: bigint;
  paidAmount: bigint;
  balance: bigint;
  dueDate: Date | null;
  status: string;
}

export interface ReceivablesPage {
  rows: ReceivableView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sumOutstanding: bigint;
  statusCounts: Record<string, number>;
}

function isStatus(value: unknown): value is ReceivableStatus {
  return typeof value === "string" && (RECEIVABLE_STATUSES as string[]).includes(value);
}

function whereFor(filter: ReceivableFilter, status?: ReceivableStatus, branchId?: string | undefined) {
  return and(
    status ? eq(receivables.status, status) : undefined,
    branchId ? eq(receivables.branchId, branchId) : undefined
  );
}

/** Piutang per invoice — filter status/cabang + paginasi server-side. */
export async function listReceivables(filter: ReceivableFilter = {}): Promise<ReceivablesPage> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
  const status = isStatus(filter.status) ? filter.status : undefined;
  const branchId = filter.branchId ?? undefined;
  const where = whereFor(filter, status, branchId);

  const [countRows, rows, totalRows, sumRows] = await Promise.all([
    db
      .select({ status: receivables.status, n: sql<number>`count(*)::int` })
      .from(receivables)
      .where(branchId ? eq(receivables.branchId, branchId) : undefined)
      .groupBy(receivables.status),
    db
      .select({
        id: receivables.id,
        invoiceId: receivables.invoiceId,
        invoiceNumber: sql<string | null>`(select invoice_number from invoices where invoices.id = ${receivables.invoiceId})`,
        customerName: customers.name,
        customerPhone: customers.phone,
        amount: receivables.amount,
        paidAmount: receivables.settledAmount,
        balance: receivables.balance,
        dueDate: receivables.dueDate,
        status: receivables.status,
      })
      .from(receivables)
      .leftJoin(customers, eq(receivables.customerId, customers.id))
      .where(where)
      .orderBy(desc(receivables.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(receivables).where(where),
    db
      .select({ outstanding: sql<string>`coalesce(sum(${receivables.balance}), 0)` })
      .from(receivables)
      .where(branchId ? eq(receivables.branchId, branchId) : undefined),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const c of countRows) statusCounts[c.status] = Number(c.n);
  const total = Number(totalRows[0]?.total ?? 0);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    sumOutstanding: BigInt(sumRows[0]?.outstanding ?? "0"),
    statusCounts,
  };
}
