/**
 * Seed Manajemen Kinerja (idempotent): data induk (unit, departemen, jabatan,
 * saluran), kamus indikator KPI, serta target awal periode berjalan.
 *
 * Target bersifat awal (dicatat di notes) — kelola via /kinerja/pengaturan dan
 * gunakan "Salin target ke periode berjalan" untuk periode berikutnya.
 *
 * Jalankan: npm run db:seed  (terpanggil otomatis dari seed/index.ts)
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  businessUnits,
  departments,
  kpiIndicators,
  kpiTargets,
  positions,
  salesChannels,
} from "@/db/schema";

// ── Util periode (zona waktu Asia/Jakarta) ─────────────────────────
function jakartaParts(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return { y, m, d };
}

export function currentMonthRange(): { start: string; end: string } {
  const { y, m } = jakartaParts();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Periode bulan sebelumnya — dipakai agar periode yang sudah lewat tetap punya target. */
export function previousMonthRange(): { start: string; end: string } {
  const { y, m } = jakartaParts();
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return {
    start: `${py}-${String(pm).padStart(2, "0")}-01`,
    end: `${py}-${String(pm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

// ── Definisi data induk ────────────────────────────────────────────
const BUSINESS_UNITS: Array<{ code: string; name: string; description: string; sortOrder: number }> = [
  { code: "AQIQAH", name: "Aqiqah", description: "Layanan aqiqah utama: paket, sapi & kambing.", sortOrder: 1 },
  { code: "QURBAN", name: "Qurban", description: "Penyelenggaraan qurban Idul Adha.", sortOrder: 2 },
  { code: "CATERING", name: "Catering", description: "Layanan katering daging & nasi box.", sortOrder: 3 },
  { code: "BUMBU", name: "BumbuNesia", description: "Produk bumbu & olahan siap saji.", sortOrder: 4 },
];

interface DeptDef {
  code: string;
  name: string;
  parent?: string;
  sortOrder: number;
}
const DEPARTMENTS: DeptDef[] = [
  { code: "MKT_SALES", name: "Marketing & Sales", sortOrder: 1 },
  { code: "CS", name: "Customer Service", parent: "MKT_SALES", sortOrder: 2 },
  { code: "CANVAS", name: "Canvas", parent: "MKT_SALES", sortOrder: 3 },
  { code: "ADMIN_MKT", name: "Admin Marketing", parent: "MKT_SALES", sortOrder: 4 },
  { code: "CONTENT", name: "Content Creator", parent: "MKT_SALES", sortOrder: 5 },
  { code: "MARKETPLACE", name: "Marketplace", parent: "MKT_SALES", sortOrder: 6 },
  { code: "RESTO_SALES", name: "Resto / Offline Sales", parent: "MKT_SALES", sortOrder: 7 },
  { code: "OPS", name: "Operasional", sortOrder: 8 },
  { code: "DAPUR", name: "Dapur", parent: "OPS", sortOrder: 9 },
  { code: "KANDANG", name: "Kandang", parent: "OPS", sortOrder: 10 },
  { code: "PACKING", name: "Packing", parent: "OPS", sortOrder: 11 },
  { code: "DELIVERY", name: "Delivery", parent: "OPS", sortOrder: 12 },
  { code: "FIN_ACC", name: "Finance & Accounting", sortOrder: 13 },
  { code: "ADMIN_FIN", name: "Admin Finance", parent: "FIN_ACC", sortOrder: 14 },
  { code: "ACCOUNTING", name: "Accounting", parent: "FIN_ACC", sortOrder: 15 },
  { code: "HR", name: "HR / SDM", sortOrder: 16 },
];

const POSITIONS: Array<{ code: string; name: string; dept: string; sortOrder: number }> = [
  { code: "POS_CS", name: "CS", dept: "CS", sortOrder: 1 },
  { code: "POS_CANVAS", name: "Canvas", dept: "CANVAS", sortOrder: 2 },
  { code: "POS_ADMIN_MKT", name: "Admin Marketing", dept: "ADMIN_MKT", sortOrder: 3 },
  { code: "POS_CONTENT", name: "Content Creator", dept: "CONTENT", sortOrder: 4 },
  { code: "POS_MKTPL", name: "Marketplace Admin", dept: "MARKETPLACE", sortOrder: 5 },
  { code: "POS_RESTO", name: "Resto / Offline Sales", dept: "RESTO_SALES", sortOrder: 6 },
  { code: "POS_DAPUR", name: "Dapur", dept: "DAPUR", sortOrder: 7 },
  { code: "POS_KANDANG", name: "Kandang", dept: "KANDANG", sortOrder: 8 },
  { code: "POS_PACKING", name: "Packing", dept: "PACKING", sortOrder: 9 },
  { code: "POS_DELIVERY", name: "Delivery", dept: "DELIVERY", sortOrder: 10 },
  { code: "POS_FIN", name: "Admin Finance", dept: "ADMIN_FIN", sortOrder: 11 },
  { code: "POS_ACC", name: "Accounting", dept: "ACCOUNTING", sortOrder: 12 },
];

const CHANNELS: Array<{ code: string; name: string; type: "ONLINE" | "OFFLINE"; sortOrder: number }> = [
  { code: "CS_WA", name: "CS / WhatsApp", type: "ONLINE", sortOrder: 1 },
  { code: "SOCIAL", name: "Social Media", type: "ONLINE", sortOrder: 2 },
  { code: "MARKETPLACE", name: "Marketplace", type: "ONLINE", sortOrder: 3 },
  { code: "DIGITAL_ADS", name: "Digital Ads", type: "ONLINE", sortOrder: 4 },
  { code: "CANVAS", name: "Canvas", type: "OFFLINE", sortOrder: 5 },
  { code: "RESTO", name: "Resto", type: "OFFLINE", sortOrder: 6 },
  { code: "B2B", name: "B2B / Corporate", type: "OFFLINE", sortOrder: 7 },
  { code: "PARTNERSHIP", name: "Partnership", type: "OFFLINE", sortOrder: 8 },
  { code: "EVENT", name: "Event / Exhibition", type: "OFFLINE", sortOrder: 9 },
];

// ── Kamus indikator KPI ────────────────────────────────────────────
type Scope = "COMPANY" | "BUSINESS_UNIT" | "CHANNEL" | "DEPARTMENT" | "POSITION";
type Unit = "CURRENCY" | "COUNT" | "PERCENT" | "RATIO" | "DURATION" | "SCORE";
type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

interface IndDef {
  code: string;
  name: string;
  scope: Scope;
  unit: Unit;
  direction?: "HIGHER_BETTER" | "LOWER_BETTER";
  freq?: Freq;
  formulaKey?: string;
  /** Kode departemen default (untuk scorecard harian). */
  dept?: string;
  weight: number;
  description?: string;
}

const INDICATORS: IndDef[] = [
  // ── Level 1: Perusahaan ──
  { code: "CO_REVENUE", name: "Pendapatan", scope: "COMPANY", unit: "CURRENCY", freq: "DAILY", formulaKey: "revenue", weight: 25, description: "SUM pembayaran CONFIRMED pada periode (basis kas)." },
  { code: "CO_NET_PROFIT", name: "Laba Bersih", scope: "COMPANY", unit: "CURRENCY", formulaKey: "net_profit", weight: 20, description: "Σ kredit akun PENDAPATAN − Σ debit akun BEBAN dari jurnal POSTED." },
  { code: "CO_CASH", name: "Kas & Bank", scope: "COMPANY", unit: "CURRENCY", freq: "DAILY", formulaKey: "cash_balance", weight: 15, description: "Saldo akun kas/bank (1-1101, 1-1102, 1-1120) s.d. akhir periode." },
  { code: "CO_CUSTOMER", name: "Pelanggan Aktif", scope: "COMPANY", unit: "COUNT", formulaKey: "customer_count", weight: 15, description: "Pelanggan unik dengan pesanan terkonfirmasi pada periode." },
  { code: "CO_RETENTION", name: "Retensi Pelanggan", scope: "COMPANY", unit: "PERCENT", formulaKey: "customer_retention", weight: 10, description: "Pelanggan repeat (periode ini & sebelumnya) ÷ pelanggan periode ini × 100." },
  { code: "CO_GROWTH", name: "Pertumbuhan Bisnis", scope: "COMPANY", unit: "PERCENT", formulaKey: "business_growth", weight: 15, description: "Δ pendapatan terhadap periode sebelumnya × 100." },

  // ── Level 2: Unit Usaha ──
  { code: "BU_REVENUE", name: "Pendapatan Unit", scope: "BUSINESS_UNIT", unit: "CURRENCY", formulaKey: "revenue_unit", weight: 30 },
  { code: "BU_MARGIN", name: "Margin Kotor Unit", scope: "BUSINESS_UNIT", unit: "PERCENT", formulaKey: "gross_margin_unit", weight: 20, description: "(Pendapatan − HPP) ÷ Pendapatan × 100. Menunggu modul HPP per unit." },
  { code: "BU_ORDERS", name: "Jumlah Pesanan", scope: "BUSINESS_UNIT", unit: "COUNT", formulaKey: "orders_count", weight: 15 },
  { code: "BU_AOV", name: "Nilai Rata-rata Pesanan", scope: "BUSINESS_UNIT", unit: "CURRENCY", formulaKey: "aov", weight: 15 },
  { code: "BU_GROWTH", name: "Pertumbuhan Unit", scope: "BUSINESS_UNIT", unit: "PERCENT", formulaKey: "growth_unit", weight: 10 },
  { code: "BU_CONTRIB", name: "Kontribusi Pendapatan", scope: "BUSINESS_UNIT", unit: "PERCENT", formulaKey: "contribution_unit", weight: 10 },

  // ── Level 3: Saluran ──
  { code: "CH_LEAD", name: "Lead Masuk", scope: "CHANNEL", unit: "COUNT", formulaKey: "channel_leads", weight: 20 },
  { code: "CH_CONV", name: "Konversi", scope: "CHANNEL", unit: "PERCENT", formulaKey: "channel_conversion", weight: 30, description: "Pesanan ÷ lead × 100 pada saluran." },
  { code: "CH_REVENUE", name: "Pendapatan Saluran", scope: "CHANNEL", unit: "CURRENCY", formulaKey: "channel_revenue", weight: 25 },
  { code: "CH_CAC", name: "Biaya Per Akuisisi", scope: "CHANNEL", unit: "CURRENCY", direction: "LOWER_BETTER", formulaKey: "channel_cac", weight: 10, description: "Spend iklan ÷ lead baru." },
  { code: "CH_ROAS", name: "ROAS", scope: "CHANNEL", unit: "RATIO", formulaKey: "channel_roas", weight: 15, description: "Pendapatan saluran ÷ spend iklan." },
  { code: "CH_RESP_TIME", name: "Waktu Respons (menit)", scope: "CHANNEL", unit: "DURATION", direction: "LOWER_BETTER", freq: "DAILY", weight: 0, description: "Input manual — rata-rata menit respons lead." },
  { code: "CH_RESTO_OMZET", name: "Omzet Resto", scope: "CHANNEL", unit: "CURRENCY", freq: "DAILY", weight: 0, description: "Input manual — omzet harian resto." },

  // ── Level 4: Departemen (bulanan) ──
  { code: "DE_ONTIME", name: "Ketepatan Pengiriman", scope: "DEPARTMENT", unit: "PERCENT", formulaKey: "delivery_on_time", weight: 40 },
  { code: "DE_COMPLAINT", name: "Komplain Pelanggan", scope: "DEPARTMENT", unit: "COUNT", direction: "LOWER_BETTER", formulaKey: "complaint_count", weight: 30 },
  { code: "DE_ATTENDANCE", name: "Kehadiran", scope: "DEPARTMENT", unit: "PERCENT", formulaKey: "attendance_rate", weight: 30 },

  // ── Level 6: Scorecard harian per departemen ──
  { code: "DY_MKT_LEAD", name: "Lead Baru", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "MKT_SALES", weight: 30 },
  { code: "DY_MKT_FOLLOWUP", name: "Follow-up Selesai", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "MKT_SALES", weight: 30 },
  { code: "DY_MKT_CONTENT", name: "Konten Terbit", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "MKT_SALES", weight: 20 },
  { code: "DY_MKT_RESP", name: "Respons CS (menit)", scope: "DEPARTMENT", unit: "DURATION", direction: "LOWER_BETTER", freq: "DAILY", dept: "MKT_SALES", weight: 20 },
  { code: "DY_MKT_MKT_ORDER", name: "Pesanan Marketplace", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "MARKETPLACE", weight: 60 },
  { code: "DY_MKT_CANCEL", name: "Pembatalan", scope: "DEPARTMENT", unit: "COUNT", direction: "LOWER_BETTER", freq: "DAILY", dept: "MARKETPLACE", weight: 40 },
  { code: "DY_MKT_OMZET", name: "Omzet Resto", scope: "DEPARTMENT", unit: "CURRENCY", freq: "DAILY", dept: "RESTO_SALES", weight: 60 },
  { code: "DY_MKT_TRANS", name: "Transaksi Resto", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "RESTO_SALES", weight: 40 },
  { code: "DY_OPS_PRODUCED", name: "Pesanan Diproduksi", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "OPS", weight: 30 },
  { code: "DY_OPS_QC", name: "QC Lulus", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "OPS", weight: 30 },
  { code: "DY_OPS_ONTIME", name: "Pengiriman Tepat Waktu", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "OPS", formulaKey: "delivery_on_time_count", weight: 20 },
  { code: "DY_OPS_DELIVERED", name: "Pengiriman Selesai", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "OPS", formulaKey: "delivery_done_count", weight: 20 },
  { code: "DY_FIN_VERIFIED", name: "Pembayaran Diverifikasi", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "FIN_ACC", formulaKey: "payments_verified", weight: 40 },
  { code: "DY_FIN_INVOICED", name: "Tagihan Terbit", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "FIN_ACC", formulaKey: "invoices_issued", weight: 30 },
  { code: "DY_FIN_OPNAME", name: "Kas Opname Sesuai (%)", scope: "DEPARTMENT", unit: "PERCENT", freq: "DAILY", dept: "FIN_ACC", weight: 30 },
  { code: "DY_HR_PRESENT", name: "Karyawan Hadir", scope: "DEPARTMENT", unit: "COUNT", freq: "DAILY", dept: "HR", formulaKey: "attendance_present", weight: 60 },
  { code: "DY_HR_LATE", name: "Keterlambatan", scope: "DEPARTMENT", unit: "COUNT", direction: "LOWER_BETTER", freq: "DAILY", dept: "HR", formulaKey: "late_count", weight: 40 },

  // ── Level 5: Jabatan ──
  { code: "POS_RESP", name: "Waktu Respons (menit)", scope: "POSITION", unit: "DURATION", direction: "LOWER_BETTER", weight: 30, description: "Input manual per jabatan." },
  { code: "POS_CONV", name: "Konversi", scope: "POSITION", unit: "PERCENT", weight: 30, description: "Input manual per jabatan." },
  { code: "POS_SAT", name: "Kepuasan Pelanggan", scope: "POSITION", unit: "SCORE", weight: 20, description: "Input manual (skor 0–100)." },
  { code: "POS_COMPLAINT", name: "Komplain", scope: "POSITION", unit: "COUNT", direction: "LOWER_BETTER", weight: 20, description: "Input manual per jabatan." },
];

// ── Target awal (periode berjalan) ─────────────────────────────────
interface TargetSeed {
  /** Kode indikator. */
  indicator: string;
  /** scopeRef: kode unit/dept/jabatan/saluran, atau null untuk company. */
  ref?: string;
  refKind?: "bu" | "dept" | "pos" | "ch";
  value: number;
  periodType?: "DAILY" | "MONTHLY";
}

function companyTargets(): TargetSeed[] {
  return [
    { indicator: "CO_REVENUE", value: 400_000_000 },
    { indicator: "CO_NET_PROFIT", value: 80_000_000 },
    { indicator: "CO_CASH", value: 50_000_000 },
    { indicator: "CO_CUSTOMER", value: 60 },
    { indicator: "CO_RETENTION", value: 30 },
    { indicator: "CO_GROWTH", value: 10 },
  ];
}

const BU_TARGETS: Record<string, Array<[string, number]>> = {
  AQIQAH: [
    ["BU_REVENUE", 250_000_000],
    ["BU_MARGIN", 30],
    ["BU_ORDERS", 60],
    ["BU_AOV", 4_166_667],
    ["BU_GROWTH", 10],
    ["BU_CONTRIB", 62.5],
  ],
  QURBAN: [
    ["BU_REVENUE", 60_000_000],
    ["BU_MARGIN", 30],
    ["BU_ORDERS", 20],
    ["BU_AOV", 3_000_000],
    ["BU_GROWTH", 10],
    ["BU_CONTRIB", 15],
  ],
  CATERING: [
    ["BU_REVENUE", 60_000_000],
    ["BU_MARGIN", 25],
    ["BU_ORDERS", 40],
    ["BU_AOV", 1_500_000],
    ["BU_GROWTH", 10],
    ["BU_CONTRIB", 15],
  ],
  BUMBU: [
    ["BU_REVENUE", 30_000_000],
    ["BU_MARGIN", 35],
    ["BU_ORDERS", 100],
    ["BU_AOV", 300_000],
    ["BU_GROWTH", 10],
    ["BU_CONTRIB", 7.5],
  ],
};

const CH_TARGETS: Record<string, Array<[string, number]>> = {
  CS_WA: [
    ["CH_LEAD", 50],
    ["CH_CONV", 30],
    ["CH_REVENUE", 120_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  SOCIAL: [
    ["CH_LEAD", 30],
    ["CH_CONV", 20],
    ["CH_REVENUE", 60_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  MARKETPLACE: [
    ["CH_LEAD", 40],
    ["CH_CONV", 25],
    ["CH_REVENUE", 80_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  DIGITAL_ADS: [
    ["CH_LEAD", 25],
    ["CH_CONV", 15],
    ["CH_REVENUE", 50_000_000],
    ["CH_CAC", 150_000],
    ["CH_ROAS", 5],
    ["CH_RESP_TIME", 5],
  ],
  CANVAS: [
    ["CH_LEAD", 20],
    ["CH_CONV", 30],
    ["CH_REVENUE", 40_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  RESTO: [
    ["CH_LEAD", 10],
    ["CH_CONV", 15],
    ["CH_REVENUE", 40_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
    ["CH_RESTO_OMZET", 15_000_000],
  ],
  B2B: [
    ["CH_LEAD", 5],
    ["CH_CONV", 40],
    ["CH_REVENUE", 20_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  PARTNERSHIP: [
    ["CH_LEAD", 5],
    ["CH_CONV", 30],
    ["CH_REVENUE", 15_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
  EVENT: [
    ["CH_LEAD", 5],
    ["CH_CONV", 15],
    ["CH_REVENUE", 15_000_000],
    ["CH_CAC", 100_000],
    ["CH_ROAS", 4],
    ["CH_RESP_TIME", 5],
  ],
};

const DEPT_MONTHLY_TARGETS: Array<[string, number]> = [
  ["DE_ONTIME", 95],
  ["DE_COMPLAINT", 3],
  ["DE_ATTENDANCE", 95],
];

const DAILY_TARGETS: Record<string, Array<[string, number]>> = {
  MKT_SALES: [
    ["DY_MKT_LEAD", 5],
    ["DY_MKT_FOLLOWUP", 5],
    ["DY_MKT_CONTENT", 1],
    ["DY_MKT_RESP", 5],
  ],
  MARKETPLACE: [
    ["DY_MKT_MKT_ORDER", 3],
    ["DY_MKT_CANCEL", 1],
  ],
  RESTO_SALES: [
    ["DY_MKT_OMZET", 5_000_000],
    ["DY_MKT_TRANS", 20],
  ],
  OPS: [
    ["DY_OPS_PRODUCED", 5],
    ["DY_OPS_QC", 5],
    ["DY_OPS_ONTIME", 3],
    ["DY_OPS_DELIVERED", 5],
  ],
  FIN_ACC: [
    ["DY_FIN_VERIFIED", 10],
    ["DY_FIN_INVOICED", 5],
    ["DY_FIN_OPNAME", 100],
  ],
  HR: [
    ["DY_HR_PRESENT", 10],
    ["DY_HR_LATE", 1],
  ],
};

const POSITION_TARGETS: Array<[string, number]> = [
  ["POS_RESP", 5],
  ["POS_CONV", 25],
  ["POS_SAT", 90],
  ["POS_COMPLAINT", 2],
];

// ── Seeder ─────────────────────────────────────────────────────────
export async function ensurePerformanceSeed(): Promise<void> {
  // 1. Business Units
  const buIds = new Map<string, string>();
  for (const u of BUSINESS_UNITS) {
    const existing = await db.select({ id: businessUnits.id }).from(businessUnits).where(eq(businessUnits.code, u.code)).limit(1);
    if (existing.length > 0) {
      buIds.set(u.code, existing[0].id);
      continue;
    }
    const [row] = await db.insert(businessUnits).values(u).returning({ id: businessUnits.id });
    buIds.set(u.code, row.id);
  }
  console.log(`  + Unit usaha (${buIds.size})`);

  // 2. Departments (induk dulu, lalu anak → parentDepartmentId)
  const deptIds = new Map<string, string>();
  for (const d of DEPARTMENTS.filter((x) => !x.parent)) {
    const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, d.code)).limit(1);
    if (existing.length > 0) deptIds.set(d.code, existing[0].id);
    else {
      const [row] = await db
        .insert(departments)
        .values({ code: d.code, name: d.name, sortOrder: d.sortOrder })
        .returning({ id: departments.id });
      deptIds.set(d.code, row.id);
    }
  }
  for (const d of DEPARTMENTS.filter((x) => x.parent)) {
    const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, d.code)).limit(1);
    if (existing.length > 0) {
      deptIds.set(d.code, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(departments)
      .values({
        code: d.code,
        name: d.name,
        parentDepartmentId: deptIds.get(d.parent ?? "") ?? null,
        sortOrder: d.sortOrder,
      })
      .returning({ id: departments.id });
    deptIds.set(d.code, row.id);
  }
  console.log(`  + Departemen (${deptIds.size})`);

  // 3. Positions
  const posIds = new Map<string, string>();
  for (const p of POSITIONS) {
    const existing = await db.select({ id: positions.id }).from(positions).where(eq(positions.code, p.code)).limit(1);
    if (existing.length > 0) {
      posIds.set(p.code, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(positions)
      .values({
        code: p.code,
        name: p.name,
        departmentId: deptIds.get(p.dept) ?? (deptIds.values().next().value as string),
        sortOrder: p.sortOrder,
      })
      .returning({ id: positions.id });
    posIds.set(p.code, row.id);
  }
  console.log(`  + Jabatan (${posIds.size})`);

  // 4. Sales Channels
  const chIds = new Map<string, string>();
  for (const c of CHANNELS) {
    const existing = await db.select({ id: salesChannels.id }).from(salesChannels).where(eq(salesChannels.code, c.code)).limit(1);
    if (existing.length > 0) {
      chIds.set(c.code, existing[0].id);
      continue;
    }
    const [row] = await db.insert(salesChannels).values(c).returning({ id: salesChannels.id });
    chIds.set(c.code, row.id);
  }
  console.log(`  + Saluran penjualan (${chIds.size})`);

  // 5. KPI Indicators
  const indIds = new Map<string, string>();
  for (const i of INDICATORS) {
    const existing = await db.select({ id: kpiIndicators.id }).from(kpiIndicators).where(eq(kpiIndicators.code, i.code)).limit(1);
    if (existing.length > 0) {
      indIds.set(i.code, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(kpiIndicators)
      .values({
        code: i.code,
        name: i.name,
        scope: i.scope,
        unit: i.unit,
        direction: i.direction ?? "HIGHER_BETTER",
        frequency: i.freq ?? "MONTHLY",
        formulaKey: i.formulaKey ?? null,
        defaultScopeRefId: i.dept ? (deptIds.get(i.dept) ?? null) : null,
        description: i.description ?? null,
        defaultWeight: String(i.weight),
      })
      .returning({ id: kpiIndicators.id });
    indIds.set(i.code, row.id);
  }
  console.log(`  + Indikator KPI (${indIds.size})`);

  // 6. Target periode berjalan + periode sebelumnya (agar periode yang sudah
  //    lewat tetap bisa dinilai dan tidak muncul sebagai "tanpa target").
  const ranges = [currentMonthRange(), previousMonthRange()];
  const NOTES = "Target awal (seed) — sesuaikan lewat Pengaturan KPI.";
  let targetCount = 0;

  async function ensureTarget(
    indicatorCode: string,
    refId: string | null,
    value: number,
    weight: number,
    periodType: "DAILY" | "MONTHLY",
    range: { start: string; end: string }
  ) {
    const indId = indIds.get(indicatorCode);
    if (!indId) return;
    const existing = await db
      .select({ id: kpiTargets.id })
      .from(kpiTargets)
      .where(
        and(
          eq(kpiTargets.indicatorId, indId),
          eq(kpiTargets.periodStart, range.start),
          eq(kpiTargets.periodEnd, range.end),
          eq(kpiTargets.periodType, periodType),
          refId ? eq(kpiTargets.scopeRefId, refId) : isNull(kpiTargets.scopeRefId)
        )
      )
      .limit(1);
    if (existing.length > 0) return;
    await db.insert(kpiTargets).values({
      indicatorId: indId,
      scopeRefId: refId,
      periodType,
      periodStart: range.start,
      periodEnd: range.end,
      targetValue: String(value),
      weight: String(weight),
      notes: NOTES,
    });
    targetCount++;
  }

  for (const range of ranges) {
    // Company
    for (const t of companyTargets()) await ensureTarget(t.indicator, null, t.value, Number(indWeight(t.indicator)), "MONTHLY", range);

    // Unit usaha
    for (const [buCode, list] of Object.entries(BU_TARGETS)) {
      for (const [indCode, value] of list) await ensureTarget(indCode, buIds.get(buCode) ?? null, value, Number(indWeight(indCode)), "MONTHLY", range);
    }

    // Saluran
    for (const [chCode, list] of Object.entries(CH_TARGETS)) {
      for (const [indCode, value] of list) {
        const isDaily = INDICATORS.find((i) => i.code === indCode)?.freq === "DAILY";
        await ensureTarget(indCode, chIds.get(chCode) ?? null, value, Number(indWeight(indCode)), isDaily ? "DAILY" : "MONTHLY", range);
      }
    }

    // Departemen bulanan (4 departemen induk)
    for (const deptCode of ["MKT_SALES", "OPS", "FIN_ACC", "HR"]) {
      for (const [indCode, value] of DEPT_MONTHLY_TARGETS) {
        await ensureTarget(indCode, deptIds.get(deptCode) ?? null, value, Number(indWeight(indCode)), "MONTHLY", range);
      }
    }

    // Scorecard harian (target harian per departemen skor)
    for (const [deptCode, list] of Object.entries(DAILY_TARGETS)) {
      for (const [indCode, value] of list) {
        await ensureTarget(indCode, deptIds.get(deptCode) ?? null, value, Number(indWeight(indCode)), "DAILY", range);
      }
    }

    // Jabatan (12 posisi × 4 indikator)
    for (const posCode of posIds.keys()) {
      for (const [indCode, value] of POSITION_TARGETS) {
        await ensureTarget(indCode, posIds.get(posCode) ?? null, value, Number(indWeight(indCode)), "MONTHLY", range);
      }
    }

    console.log(`  + Target KPI periode ${range.start} → ${range.end}`);
  }
  console.log(`  + Total target KPI baru: ${targetCount} baris`);
}

function indWeight(code: string): number {
  return INDICATORS.find((i) => i.code === code)?.weight ?? 0;
}

export const performanceSeedMeta = { BUSINESS_UNITS, DEPARTMENTS, POSITIONS, CHANNELS, INDICATORS };

// catatan: ensureMap dipakai untuk kebutuhan di luar file ini bila diperlukan
export type { Scope, Unit, Freq };
