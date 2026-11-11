import "server-only";
import { eq, or, sql, type SQL } from "drizzle-orm";
import { leads } from "@/db/schema";
import { growthPercent, safePercent, safeRatio } from "@/lib/score-engine";
import { firstRow } from "@/lib/server/sql-helpers";
import { eventCount, moduleEverUsed, volumeCount } from "./kpi-activity";

/**
 * Registry formula KPI: peta formulaKey → penghitung dari tabel ERP nyata.
 *
 * Konvensi:
 * - Periode (`start`–`end`) adalah tanggal kalender Asia/Jakarta, inklusif.
 * - Nilai CURRENCY dalam **Rupiah** (konversi dari penyimpanan rupiah penuh).
 * - Mengembalikan `null` bila data sumber belum tersedia ("Menunggu modul")
 *   atau belum terukur (mis. modul belum pernah dipakai) — lihat kpi-activity.ts.
 */

export type FormulaScope = "COMPANY" | "BUSINESS_UNIT" | "CHANNEL" | "DEPARTMENT" | "POSITION";

export interface FormulaCtx {
  start: string;
  end: string;
  branchId?: string;
  scope: FormulaScope;
  scopeRefId?: string | null;
  /** Kode master (unit/saluran/departemen) — untuk fallback pencocokan string lama. */
  refCode?: string | null;
}

export type FormulaFn = (ctx: FormulaCtx) => Promise<number | null>;

/** Kolom timestamp dibandingkan sebagai tanggal kalender Asia/Jakarta. */
function inPeriod(col: SQL, start: string, end: string): SQL {
  return sql`(${col} at time zone 'Asia/Jakarta')::date between ${start}::date and ${end}::date`;
}

function onOrBefore(col: SQL, end: string): SQL {
  return sql`(${col} at time zone 'Asia/Jakarta')::date <= ${end}::date`;
}

function roundedRupiah(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value);
}

/** Pemetaan sumber lead lama → kode saluran (untuk data sebelum kolom channelId ada). */
const SOURCE_BY_CHANNEL: Record<string, string> = {
  SOCIAL: "SOCIAL",
  MARKETPLACE: "MARKETPLACE",
  DIGITAL_ADS: "ADS",
};

function orderChannelCond(ctx: FormulaCtx, alias = "o"): SQL | undefined {
  if (!ctx.scopeRefId) return undefined;
  const ch = sql.raw(`${alias}.channel_id`);
  const legacy = sql.raw(`${alias}.channel`);
  if (ctx.refCode) {
    return or(eq(ch, ctx.scopeRefId), sql`upper(${legacy}) = ${ctx.refCode.toUpperCase()}`) as SQL;
  }
  return eq(ch, ctx.scopeRefId);
}

function leadChannelCond(ctx: FormulaCtx): SQL | undefined {
  if (!ctx.scopeRefId) return undefined;
  const conds: SQL[] = [eq(leads.channelId, ctx.scopeRefId)];
  const source = ctx.refCode ? SOURCE_BY_CHANNEL[ctx.refCode] : undefined;
  if (source) conds.push(eq(leads.source, source as never));
  return or(...conds) as SQL;
}

function periodRevenueSql(start: string, end: string, branchId?: string): SQL {
  return sql`
    select coalesce(sum(p.amount), 0)::float8 as value
    from payments p
    where p.status = 'CONFIRMED'
      ${branchId ? sql`and p.branch_id = ${branchId}` : sql``}
      and ${inPeriod(sql`p.paid_at`, start, end)}
  `;
}

async function revenueSen(ctx: { start: string; end: string; branchId?: string }): Promise<number> {
  const row = await firstRow<{ value: number }>(
    sql`select coalesce(sum(p.amount), 0)::float8 as value
        from payments p
        where p.status = 'CONFIRMED'
          ${ctx.branchId ? sql`and p.branch_id = ${ctx.branchId}` : sql``}
          and ${inPeriod(sql`p.paid_at`, ctx.start, ctx.end)}`
  );
  return Number(row?.value ?? 0);
}

/** Periode sebelumnya dengan panjang yang sama (dalam hari). */
export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(prevStart), end: iso(prevEnd) };
}

/** Pendapatan per unit (via orders / invoices pada pembayaran). */
async function unitRevenueSen(ctx: FormulaCtx): Promise<number> {
  if (!ctx.scopeRefId) return 0;
  const row = await firstRow<{ value: number }>(sql`
    select coalesce(sum(p.amount), 0)::float8 as value
    from payments p
    left join orders o on o.id = p.order_id
    left join invoices i on i.id = p.invoice_id
    where p.status = 'CONFIRMED'
      ${ctx.branchId ? sql`and p.branch_id = ${ctx.branchId}` : sql``}
      and ${inPeriod(sql`p.paid_at`, ctx.start, ctx.end)}
      and ((o.id is not null and o.business_unit_id = ${ctx.scopeRefId})
        or (i.id is not null and i.business_unit_id = ${ctx.scopeRefId}))
  `);
  return Number(row?.value ?? 0);
}

async function channelRevenueRp(ctx: FormulaCtx): Promise<number | null> {
  const cond = orderChannelCond(ctx);
  if (!cond) return null;
  const row = await firstRow<{ value: number }>(sql`
    select coalesce(sum(p.amount), 0)::float8 as value
    from payments p
    join orders o on o.id = p.order_id
    where p.status = 'CONFIRMED'
      ${ctx.branchId ? sql`and p.branch_id = ${ctx.branchId}` : sql``}
      and ${inPeriod(sql`p.paid_at`, ctx.start, ctx.end)}
      and ${cond}
  `);
  return Number(row?.value ?? 0);
}

async function channelLeadsCount(ctx: FormulaCtx): Promise<number> {
  const cond = leadChannelCond(ctx);
  const row = await firstRow<{ value: number }>(sql`
    select count(*)::float8 as value
    from leads
    where deleted_at is null
      ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
      ${cond ? sql`and ${cond}` : sql``}
      and ${inPeriod(sql`"createdAt"`, ctx.start, ctx.end)}
  `);
  return Number(row?.value ?? 0);
}

async function channelOrdersCount(ctx: FormulaCtx): Promise<number> {
  const cond = orderChannelCond(ctx);
  const row = await firstRow<{ value: number }>(sql`
    select count(*)::float8 as value
    from orders o
    where o.status <> 'CANCELLED'
      ${ctx.branchId ? sql`and o.branch_id = ${ctx.branchId}` : sql``}
      ${cond ? sql`and ${cond}` : sql``}
      and ${inPeriod(sql`o."createdAt"`, ctx.start, ctx.end)}
  `);
  return Number(row?.value ?? 0);
}

async function marketingSpendRp(ctx: FormulaCtx): Promise<number> {
  if (!ctx.scopeRefId) return 0;
  const row = await firstRow<{ value: number }>(sql`
    select coalesce(sum(amount), 0)::float8 as value
    from marketing_spends
    where channel_id = ${ctx.scopeRefId}
      and period_start <= ${ctx.end}::date and period_end >= ${ctx.start}::date
  `);
  return Number(row?.value ?? 0);
}

async function ordersStats(
  ctx: FormulaCtx,
  period: { start: string; end: string }
): Promise<{ count: number; totalSen: number }> {
  const unitCond = ctx.scope === "BUSINESS_UNIT" && ctx.scopeRefId ? sql`and o.business_unit_id = ${ctx.scopeRefId}` : sql``;
  const row = await firstRow<{ count: number; total: number }>(sql`
    select count(*)::float8 as count, coalesce(sum(o.total), 0)::float8 as total
    from orders o
    where o.status <> 'CANCELLED'
      ${ctx.branchId ? sql`and o.branch_id = ${ctx.branchId}` : sql``}
      ${unitCond}
      and ${inPeriod(sql`o."createdAt"`, period.start, period.end)}
  `);
  return { count: Number(row?.count ?? 0), totalSen: Number(row?.total ?? 0) };
}

/** Kehadiran: aturan hierarki departemen bila scopeRefId adalah departemen induk. */
function attendanceDeptCond(ctx: FormulaCtx): SQL | undefined {
  if (ctx.scope !== "DEPARTMENT" || !ctx.scopeRefId) return undefined;
  return sql`exists (
    select 1 from departments d
    where d.id = e.department_id
      and (d.id = ${ctx.scopeRefId} or d.parent_department_id = ${ctx.scopeRefId})
  )`;
}

export const FORMULAS: Record<string, FormulaFn> = {
  // ── Level 1: Perusahaan ──
  async revenue(ctx) {
    if (!(await moduleEverUsed("payments"))) return null;
    const row = await firstRow<{ value: number }>(
      sql`select coalesce(sum(p.amount), 0)::float8 as value
          from payments p
          where p.status = 'CONFIRMED'
            ${ctx.branchId ? sql`and p.branch_id = ${ctx.branchId}` : sql``}
            and ${inPeriod(sql`p.paid_at`, ctx.start, ctx.end)}`
    );
    return Number(row?.value ?? 0);
  },

  async net_profit(ctx) {
    if (!(await moduleEverUsed("journals"))) return null;
    const row = await firstRow<{ value: number }>(sql`
      select coalesce(sum(
        case when a.type = 'INCOME' then jl.credit - jl.debit
             else jl.debit - jl.credit end
      ), 0)::float8 as value
      from journal_lines jl
      join journals j on j.id = jl.journal_id
      join accounts a on a.id = jl.account_id
      where j.status = 'POSTED'
        ${ctx.branchId ? sql`and j.branch_id = ${ctx.branchId}` : sql``}
        and a.type in ('INCOME', 'EXPENSE')
        and ${inPeriod(sql`j.journal_date`, ctx.start, ctx.end)}
    `);
    return Number(row?.value ?? 0);
  },

  async cash_balance(ctx) {
    if (!(await moduleEverUsed("accounts"))) return null;
    const row = await firstRow<{ value: number }>(sql`
      select (
        (select coalesce(sum(opening_balance), 0) from accounts
          where code in ('1-1101', '1-1102', '1-1120'))
        + (select coalesce(sum(jl.debit - jl.credit), 0)
           from journal_lines jl
           join journals j on j.id = jl.journal_id
           join accounts a on a.id = jl.account_id
           where a.code in ('1-1101', '1-1102', '1-1120')
             and j.status = 'POSTED'
             ${ctx.branchId ? sql`and j.branch_id = ${ctx.branchId}` : sql``}
             and ${onOrBefore(sql`j.journal_date`, ctx.end)})
      )::float8 as value
    `);
    return Number(row?.value ?? 0);
  },

  async customer_count(ctx) {
    if (!(await moduleEverUsed("orders"))) return null;
    const row = await firstRow<{ value: number }>(sql`
      select count(distinct customer_id)::float8 as value
      from orders
      where customer_id is not null
        and status not in ('DRAFT', 'CANCELLED')
        ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
        and ${inPeriod(sql`"createdAt"`, ctx.start, ctx.end)}
    `);
    return Number(row?.value ?? 0);
  },

  async customer_retention(ctx) {
    const prev = previousPeriod(ctx.start, ctx.end);
    const [cur, both] = await Promise.all([
      firstRow<{ value: number }>(sql`
        select count(distinct customer_id)::float8 as value
        from orders
        where customer_id is not null and status not in ('DRAFT', 'CANCELLED')
          ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
          and ${inPeriod(sql`"createdAt"`, ctx.start, ctx.end)}`),
      firstRow<{ value: number }>(sql`
        select count(*)::float8 as value from (
          select distinct customer_id from orders
          where customer_id is not null and status not in ('DRAFT', 'CANCELLED')
            ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
            and ${inPeriod(sql`"createdAt"`, ctx.start, ctx.end)}
        ) c
        where exists (
          select 1 from orders o2
          where o2.customer_id = c.customer_id
            and o2.status not in ('DRAFT', 'CANCELLED')
            ${ctx.branchId ? sql`and o2.branch_id = ${ctx.branchId}` : sql``}
            and ${inPeriod(sql`o2."createdAt"`, prev.start, prev.end)}
        )`),
    ]);
    return safePercent(Number(both?.value ?? 0), Number(cur?.value ?? 0));
  },

  async business_growth(ctx) {
    const prev = previousPeriod(ctx.start, ctx.end);
    const [cur, before] = await Promise.all([revenueSen(ctx), revenueSen(prev)]);
    return growthPercent(cur, before);
  },

  // ── Level 2: Unit Usaha ──
  async revenue_unit(ctx) {
    if (!ctx.scopeRefId) return null;
    if (!(await moduleEverUsed("payments"))) return null;
    return roundedRupiah(await unitRevenueSen(ctx));
  },

  async gross_margin_unit() {
    // HPP belum teratribusi per unit usaha → menunggu modul HPP.
    return null;
  },

  async orders_count(ctx) {
    if (!(await moduleEverUsed("orders"))) return null;
    const stats = await ordersStats(ctx, ctx);
    return stats.count;
  },

  async aov(ctx) {
    const stats = await ordersStats(ctx, ctx);
    // Tanpa pesanan tidak ada nilai transaksi-rata-rata (bukan 0).
    if (stats.count === 0) return null;
    return Math.round(stats.totalSen / stats.count);
  },

  async growth_unit(ctx) {
    if (!ctx.scopeRefId) return null;
    const prev = previousPeriod(ctx.start, ctx.end);
    const [cur, before] = await Promise.all([unitRevenueSen(ctx), unitRevenueSen({ ...ctx, ...prev })]);
    return growthPercent(cur, before);
  },

  async contribution_unit(ctx) {
    if (!ctx.scopeRefId) return null;
    const [unit, total] = await Promise.all([unitRevenueSen(ctx), revenueSen(ctx)]);
    return safePercent(unit, total);
  },

  // ── Level 3: Saluran ──
  async channel_leads(ctx) {
    if (!ctx.scopeRefId) return null;
    if (!(await moduleEverUsed("leads"))) return null;
    return channelLeadsCount(ctx);
  },

  async channel_conversion(ctx) {
    if (!ctx.scopeRefId) return null;
    const [o, l] = await Promise.all([channelOrdersCount(ctx), channelLeadsCount(ctx)]);
    return safePercent(o, l);
  },

  async channel_revenue(ctx) {
    if (!ctx.scopeRefId) return null;
    if (!(await moduleEverUsed("payments"))) return null;
    return channelRevenueRp(ctx);
  },

  async channel_cac(ctx) {
    if (!ctx.scopeRefId) return null;
    const [spend, l] = await Promise.all([marketingSpendRp(ctx), channelLeadsCount(ctx)]);
    // Tanpa-recorded spend iklan → CAC tidak terukur (bukan 0 → LOWER_BETTER 120).
    if (l === 0 || spend === 0) return null;
    return Math.round(spend / l);
  },

  async channel_roas(ctx) {
    if (!ctx.scopeRefId) return null;
    const [spend, rev] = await Promise.all([marketingSpendRp(ctx), channelRevenueRp(ctx)]);
    if (spend === 0 || rev === null) return null;
    return safeRatio(rev, spend);
  },

  async channel_orders(ctx) {
    if (!ctx.scopeRefId) return null;
    if (!(await moduleEverUsed("orders"))) return null;
    return channelOrdersCount(ctx);
  },

  // ── Level 4: Departemen ──
  async delivery_on_time(ctx) {
    const row = await firstRow<{ total: number; ontime: number }>(sql`
      select count(*)::float8 as total,
             count(*) filter (
               where (d.arrived_at at time zone 'Asia/Jakarta')::date
                     <= (d.scheduled_date at time zone 'Asia/Jakarta')::date
             )::float8 as ontime
      from deliveries d
      where d.arrived_at is not null and d.scheduled_date is not null
        ${ctx.branchId ? sql`and d.branch_id = ${ctx.branchId}` : sql``}
        and ${inPeriod(sql`d.scheduled_date`, ctx.start, ctx.end)}
    `);
    return safePercent(Number(row?.ontime ?? 0), Number(row?.total ?? 0));
  },

  async complaint_count(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from customer_complaints
      where ${ctx.branchId ? sql`branch_id = ${ctx.branchId} and` : sql``}
        ${inPeriod(sql`received_at`, ctx.start, ctx.end)}
    `);
    // 0 komplain hanya bermakna bila ada aktivitas bisnis (pesanan) di periode;
    // tanpa itu 0 adalah ketiadaan data, bukan prestasi.
    return eventCount(
      "complaints",
      Number(row?.value ?? 0),
      "orders",
      { start: ctx.start, end: ctx.end },
      ctx.branchId
    );
  },

  async attendance_rate(ctx) {
    const deptCond = attendanceDeptCond(ctx);
    const row = await firstRow<{ total: number; present: number }>(sql`
      select count(*)::float8 as total,
             count(*) filter (where ar.status in ('HADIR', 'TERLAMBAT'))::float8 as present
      from attendance_records ar
      join employees e on e.id = ar.employee_id
      where ar.date between ${ctx.start}::date and ${ctx.end}::date
        ${deptCond ? sql`and ${deptCond}` : sql``}
    `);
    return safePercent(Number(row?.present ?? 0), Number(row?.total ?? 0));
  },

  // ── Scorecard harian ──
  async delivery_on_time_count(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from deliveries d
      where d.arrived_at is not null and d.scheduled_date is not null
        and ${inPeriod(sql`d.arrived_at`, ctx.start, ctx.end)}
        and (d.arrived_at at time zone 'Asia/Jakarta')::date
            <= (d.scheduled_date at time zone 'Asia/Jakarta')::date
    `);
    return volumeCount("deliveries", Number(row?.value ?? 0));
  },

  async delivery_done_count(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from deliveries
      where coalesce(completed_at, arrived_at) is not null
        and ${inPeriod(sql`coalesce(completed_at, arrived_at)`, ctx.start, ctx.end)}
    `);
    return volumeCount("deliveries", Number(row?.value ?? 0));
  },

  async payments_verified(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from payments
      where status = 'CONFIRMED'
        ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
        and ${inPeriod(sql`coalesce(paid_at, payment_date, "createdAt")`, ctx.start, ctx.end)}
    `);
    return volumeCount("payments", Number(row?.value ?? 0));
  },

  async invoices_issued(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from invoices
      where status in ('ISSUED', 'PARTIAL', 'PAID')
        ${ctx.branchId ? sql`and branch_id = ${ctx.branchId}` : sql``}
        and issue_date is not null
        and ${inPeriod(sql`issue_date`, ctx.start, ctx.end)}
    `);
    return volumeCount("invoices", Number(row?.value ?? 0));
  },

  async attendance_present(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from attendance_records
      where status in ('HADIR', 'TERLAMBAT')
        and date between ${ctx.start}::date and ${ctx.end}::date
    `);
    return volumeCount("attendance", Number(row?.value ?? 0));
  },

  async late_count(ctx) {
    const row = await firstRow<{ value: number }>(sql`
      select count(*)::float8 as value
      from attendance_records
      where status = 'TERLAMBAT'
        and date between ${ctx.start}::date and ${ctx.end}::date
    `);
    // 0 keterlambatan hanya bermakna bila ada catatan absensi di periode.
    return eventCount(
      "attendance",
      Number(row?.value ?? 0),
      "attendance",
      { start: ctx.start, end: ctx.end }
    );
  },
};

export function hasFormula(key: string): boolean {
  return Object.hasOwn(FORMULAS, key);
}

export async function runFormula(key: string, ctx: FormulaCtx): Promise<number | null> {
  const fn = FORMULAS[key];
  if (!fn) return null;
  try {
    return await fn(ctx);
  } catch (err) {
    console.error(`[kpi-formula] ${key} gagal:`, err);
    return null;
  }
}

/** Kode formula yang tersedia (untuk UI/deskripsi). */
export const FORMULA_KEYS = Object.keys(FORMULAS).sort();

// ── Util agregat untuk snapshot mingguan/bulanan ───────────────────
export async function companyRevenueRp(period: { start: string; end: string }): Promise<number | null> {
  if (!(await moduleEverUsed("payments"))) return null;
  const row = await firstRow<{ value: number }>(periodRevenueSql(period.start, period.end));
  return Number(row?.value ?? 0);
}

export async function countLeads(period: { start: string; end: string }): Promise<number | null> {
  if (!(await moduleEverUsed("leads"))) return null;
  const row = await firstRow<{ value: number }>(
    sql`select count(*)::float8 as value from leads
        where deleted_at is null and ${inPeriod(sql`"createdAt"`, period.start, period.end)}`
  );
  return Number(row?.value ?? 0);
}

export async function countOrders(period: { start: string; end: string }): Promise<number | null> {
  if (!(await moduleEverUsed("orders"))) return null;
  const row = await firstRow<{ value: number }>(
    sql`select count(*)::float8 as value from orders
        where status not in ('DRAFT', 'CANCELLED')
          and ${inPeriod(sql`"createdAt"`, period.start, period.end)}`
  );
  return Number(row?.value ?? 0);
}

export async function countComplaints(period: { start: string; end: string }): Promise<number | null> {
  const row = await firstRow<{ value: number }>(
    sql`select count(*)::float8 as value from customer_complaints
        where ${inPeriod(sql`received_at`, period.start, period.end)}`
  );
  // 0 komplain tanpa aktivitas bisnis = ketiadaan data, bukan prestasi.
  return eventCount("complaints", Number(row?.value ?? 0), "orders", period);
}

export async function channelOrdersByCode(code: string, period: { start: string; end: string }): Promise<number> {
  const row = await firstRow<{ value: number }>(sql`
    select count(*)::float8 as value from orders o
    where o.status not in ('DRAFT', 'CANCELLED')
      and ${inPeriod(sql`o."createdAt"`, period.start, period.end)}
      and (upper(o.channel) = ${code.toUpperCase()} or o.channel_id in (
        select id from sales_channels where code = ${code.toUpperCase()}
      ))
  `);
  return Number(row?.value ?? 0);
}

export async function deliveryOnTimePercent(period: { start: string; end: string }): Promise<number | null> {
  const row = await firstRow<{ total: number; ontime: number }>(sql`
    select count(*)::float8 as total,
           count(*) filter (
             where (d.arrived_at at time zone 'Asia/Jakarta')::date
                   <= (d.scheduled_date at time zone 'Asia/Jakarta')::date
           )::float8 as ontime
    from deliveries d
    where d.arrived_at is not null and d.scheduled_date is not null
      and ${inPeriod(sql`d.scheduled_date`, period.start, period.end)}
  `);
  return safePercent(Number(row?.ontime ?? 0), Number(row?.total ?? 0));
}
