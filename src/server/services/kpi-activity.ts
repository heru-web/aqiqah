import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { firstRow } from "@/lib/server/sql-helpers";

/**
 * Lapisan aktivitas KPI — membedakan "nilai 0 yang facta" dari "tidak ada data".
 *
 * Tiga aturan dasar (rujukan: docs/PERFORMANCE_MANAGEMENT_SYSTEM.md §9 & §13):
 * 1. **Modul sumber belum pernah dipakai** (tabelnya kosong) → metrik `null`
 *    → UI menampilkan "Menunggu modul", bukan angka 0.
 * 2. **Metrik volume** (pendapatan, jumlah pesanan, tagihan, dsb.) bernilai 0
 *    tetap facta selama modulnya sudah dipakai: tidak ada penjualan = fakta.
 * 3. **Metrik "peristiwa buruk"** (komplain, keterlambatan) bernilai 0 hanya sah
 *    bila ada aktivitas di periode tersebut. Tanpa aktivitas, 0 bukan prestasi
 *    melainkan ketiadaan data.
 *
 * Cache TTL pendek: dasbor memeriksa dozens scope dengan periode/cabang yang
 * sama, sehingga hasil yang sama di-cache agar database tidak terbebani.
 */

export type ActivitySource =
  | "payments"
  | "orders"
  | "invoices"
  | "deliveries"
  | "leads"
  | "complaints"
  | "attendance"
  | "journals"
  | "spend"
  | "accounts";

interface SourceDef {
  table: string;
  period: "timestamp" | "date" | "overlap" | "none";
  timeColumn?: string;
  startColumn?: string;
  endColumn?: string;
  branchColumn?: string;
  extra?: SQL;
}

/** Definisi sumber data ERP (nama tabel/kolom literal di database). */
const SOURCES: Record<ActivitySource, SourceDef> = {
  payments: {
    table: "payments",
    period: "timestamp",
    timeColumn: 'coalesce(paid_at, payment_date, "createdAt")',
    branchColumn: "branch_id",
  },
  orders: {
    table: "orders",
    period: "timestamp",
    timeColumn: '"createdAt"',
    branchColumn: "branch_id",
    extra: sql`status not in ('DRAFT', 'CANCELLED')`,
  },
  invoices: {
    table: "invoices",
    period: "timestamp",
    timeColumn: "issue_date",
    branchColumn: "branch_id",
  },
  deliveries: {
    table: "deliveries",
    period: "timestamp",
    timeColumn: "scheduled_date",
    branchColumn: "branch_id",
  },
  leads: {
    table: "leads",
    period: "timestamp",
    timeColumn: '"createdAt"',
    branchColumn: "branch_id",
    extra: sql`deleted_at is null`,
  },
  complaints: {
    table: "customer_complaints",
    period: "timestamp",
    timeColumn: "received_at",
    branchColumn: "branch_id",
  },
  attendance: {
    table: "attendance_records",
    period: "date",
    timeColumn: "date",
  },
  journals: {
    table: "journals",
    period: "timestamp",
    timeColumn: "journal_date",
    branchColumn: "branch_id",
    extra: sql`status = 'POSTED'`,
  },
  spend: {
    table: "marketing_spends",
    period: "overlap",
    startColumn: "period_start",
    endColumn: "period_end",
    branchColumn: "branch_id",
  },
  accounts: { table: "accounts", period: "none" },
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: boolean; expires: number }>();

async function cached(key: string, compute: () => Promise<boolean>): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await compute();
  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return value;
}

function periodCondition(def: SourceDef, start: string, end: string, branchId?: string): SQL {
  const parts: SQL[] = [];
  if (def.period === "timestamp") {
    parts.push(
      sql`(${sql.raw(def.timeColumn!)} at time zone 'Asia/Jakarta')::date between ${start}::date and ${end}::date`
    );
  } else if (def.period === "date") {
    parts.push(sql`${sql.raw(def.timeColumn!)} between ${start}::date and ${end}::date`);
  } else if (def.period === "overlap") {
    parts.push(sql`${sql.raw(def.startColumn!)} <= ${end}::date and ${sql.raw(def.endColumn!)} >= ${start}::date`);
  }
  if (def.branchColumn && branchId) {
    parts.push(sql`${sql.raw(def.branchColumn)} = ${branchId}`);
  }
  if (def.extra) parts.push(def.extra);
  if (parts.length === 0) return sql`true`;
  return sql.join(parts, sql` and `);
}

/** True bila modul sumber pernah dipakai sama sekali (tabelnya punya baris). */
export function moduleEverUsed(source: ActivitySource): Promise<boolean> {
  const def = SOURCES[source];
  return cached(`ever:${source}`, async () => {
    const row = await firstRow<{ value: boolean }>(
      sql`select exists(select 1 from ${sql.raw(def.table)}) as value`
    );
    return row?.value === true;
  });
}

/** True bila sumber punya aktivitas di dalam periode (dibatasi cabang bila ada). */
export function hasActivityInPeriod(
  source: ActivitySource,
  period: { start: string; end: string },
  branchId?: string
): Promise<boolean> {
  const def = SOURCES[source];
  const key = `per:${source}:${period.start}:${period.end}:${branchId ?? "*"}`;
  return cached(key, async () => {
    if (def.period === "none") return moduleEverUsed(source);
    const cond = periodCondition(def, period.start, period.end, branchId);
    const row = await firstRow<{ value: number }>(
      sql`select count(*)::float8 as value from ${sql.raw(def.table)} where ${cond}`
    );
    return Number(row?.value ?? 0) > 0;
  });
}

/**
 * Sumber yang dipakai untuk menilai apakah sebuah periode "kosong".
 * Bila satu saja punya aktivitas, periode itu bisa dinilai (metrik yang
 * bernilai 0 saat itu adalah fakta, bukan ketiadaan data).
 */
const PERIOD_ACTIVITY_SOURCES: ActivitySource[] = [
  "orders",
  "payments",
  "invoices",
  "deliveries",
  "leads",
  "attendance",
  "complaints",
  "journals",
  "spend",
];

/**
 * True bila tidak ada aktivitas sama sekali di periode tersebut.
 * Periode kosong tidak bisa dinilai (bukan "performa nol"): tidak ada transaksi,
 * absensi, atau catatan apa pun → semua KPI berstatus "Belum ada data".
 */
export async function isPeriodEmpty(
  period: { start: string; end: string },
  branchId?: string
): Promise<boolean> {
  for (const source of PERIOD_ACTIVITY_SOURCES) {
    if (await hasActivityInPeriod(source, period, branchId)) return false;
  }
  return true;
}

/**
 * Metrik volume (pendapatan, jumlah pesanan, tagihan, dsb.).
 * 0 tetap facta selama modul sumber sudah pernah dipakai — tidak ada
 * penjualan adalah fakta. Bila modulnya belum pernah dipakai → null.
 */
export async function volumeCount(source: ActivitySource, count: number): Promise<number | null> {
  if (count > 0) return count;
  return (await moduleEverUsed(source)) ? 0 : null;
}

/**
 * Metrik "peristiwa buruk" (komplain, keterlambatan).
 * 0 hanya sah bila modulnya sudah dipakai DAN ada aktivitas dasar di periode
 * tersebut — tanpa aktivitas, 0 bukan prestasi melainkan ketiadaan data.
 */
export async function eventCount(
  source: ActivitySource,
  count: number,
  basis: ActivitySource,
  period: { start: string; end: string },
  branchId?: string
): Promise<number | null> {
  if (count > 0) return count;
  if (!(await moduleEverUsed(source))) return null;
  const active = await hasActivityInPeriod(basis, period, branchId);
  return active ? 0 : null;
}
