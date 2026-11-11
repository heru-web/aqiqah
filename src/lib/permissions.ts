/**
 * Katalog & helper RBAC.
 * Format permission: <module>.<resource>.<action>  contoh: "orders.create".
 * Digunakan oleh server (can/requirePermission) dan UI (role editor, guard).
 */

export const ACTIONS = ["view", "create", "update", "delete", "action"] as const;
export type Action = (typeof ACTIONS)[number];

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

const r = (group: string, labels: Record<string, string>): PermissionDef[] => {
  const taken: Record<string, boolean> = {};
  const out: PermissionDef[] = [];
  for (const [resource, label] of Object.entries(labels)) {
    for (const action of ACTIONS) {
      const key = `${group}.${resource}.${action}`;
      if (taken[key]) continue;
      taken[key] = true;
      out.push({
        key,
        label: `${label} · ${action}`,
        group: permGroupTitle(group),
      });
    }
  }
  return out;
};

function permGroupTitle(module: string): string {
  const titles: Record<string, string> = {
    dashboard: "Dasbor",
    crm: "CRM / Prospek",
    customers: "Pelanggan",
    products: "Produk & Paket",
    quotations: "Penawaran",
    orders: "Pesanan",
    invoices: "Tagihan",
    payments: "Pembayaran",
    production: "Produksi",
    inventory: "Inventaris",
    delivery: "Pengiriman",
    employees: "Karyawan",
    attendance: "Absensi",
    kpi: "KPI",
    payroll: "Penggajian",
    kasbon: "Kasbon",
    cash: "Kas & Bank",
    receivables: "Piutang",
    payables: "Hutang",
    accounting: "Akuntansi",
    coa: "Bagan Akun",
    hpp: "HPP",
    reconciliation: "Rekonsiliasi",
    reports: "Laporan",
    ziswaf: "ZISWAF",
    notifications: "Notifikasi",
    audit: "Log Audit",
    users: "Pengguna",
    roles: "Peran & Hak Akses",
    branches: "Cabang",
    settings: "Pengaturan",
    performance: "Manajemen Kinerja",
    master: "Data Induk",
    indicators: "Indikator KPI",
    targets: "Target KPI",
    actuals: "Aktual KPI",
    scorecards: "Scorecard Harian",
    weekly: "Review Mingguan",
    monthly: "Review Bulanan",
    individual: "Kinerja Individu",
  };
  return titles[module] ?? module;
}

/** Semua permission yang dikenal sistem. */
export const PERMISSIONS: PermissionDef[] = [
  ...r("dashboard", { home: "Dasbor" }),
  ...r("crm", { pipeline: "Pipa CRM", followups: "Follow-up" }),
  ...r("customers", { customers: "Pelanggan", communications: "Komunikasi" }),
  ...r("products", { products: "Produk", packages: "Paket", pricing: "Harga" }),
  ...r("quotations", { quotations: "Penawaran" }),
  ...r("orders", { orders: "Pesanan", status: "Status Pesanan" }),
  ...r("invoices", { invoices: "Tagihan" }),
  ...r("payments", { payments: "Pembayaran" }),
  ...r("production", { batches: "Batch Produksi", qc: "Quality Control" }),
  ...r("inventory", {
    stock: "Persediaan",
    ledger: "Ledger",
    adjustment: "Penyesuaian Stok",
    procurement: "Pembelian",
  }),
  ...r("delivery", { deliveries: "Pengiriman", routes: "Rute" }),
  ...r("employees", { employees: "Karyawan" }),
  ...r("attendance", { attendance: "Absensi" }),
  ...r("kpi", { kpi: "KPI" }),
  ...r("payroll", { payroll: "Penggajian" }),
  ...r("kasbon", { kasbon: "Kasbon" }),
  ...r("cash", { cash: "Kas & Bank", transfers: "Transfer" }),
  ...r("receivables", { receivables: "Piutang" }),
  ...r("payables", { payables: "Hutang" }),
  ...r("accounting", { journals: "Jurnal", posting: "Posting" }),
  ...r("coa", { coa: "Bagan Akun" }),
  ...r("hpp", { hpp: "HPP" }),
  ...r("reconciliation", { reconciliation: "Rekonsiliasi" }),
  ...r("reports", { reports: "Laporan" }),
  ...r("ziswaf", { ziswaf: "ZISWAF" }),
  ...r("notifications", { notifications: "Notifikasi" }),
  ...r("audit", { audit: "Log Audit" }),
  ...r("users", { users: "Pengguna" }),
  ...r("roles", { roles: "Peran" }),
  ...r("branches", { branches: "Cabang" }),
  ...r("settings", { settings: "Pengaturan" }),
  ...r("performance", {
    master: "Data Induk",
    indicators: "Indikator KPI",
    targets: "Target KPI",
    actuals: "Aktual KPI",
    scorecards: "Scorecard Harian",
    weekly: "Review Mingguan",
    monthly: "Review Bulanan",
    individual: "Kinerja Individu",
  }),
];

const ALLOWED = new Set<string>(PERMISSIONS.map((p) => p.key));

export function isKnownPermission(key: string): boolean {
  return ALLOWED.has(key);
}

/** Wildcard: "system.audit.*" atau "accounting.*" juga valid untuk seed. */
export function can(permissions: string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  const [module, resource] = required.split(".");
  if (permissions.includes(`${module}.${resource}.*`)) return true;
  if (permissions.includes(`${module}.*`)) return true;
  return permissions.includes(required);
}

export function canAny(permissions: string[], required: string[]): boolean {
  return required.some((p) => can(permissions, p));
}

export function canAll(permissions: string[], required: string[]): boolean {
  return required.every((p) => can(permissions, p));
}

/** Grup permission untuk editor UI. */
export function permissionGroups(): Map<string, PermissionDef[]> {
  const map = new Map<string, PermissionDef[]>();
  for (const p of PERMISSIONS) {
    const list = map.get(p.group) ?? [];
    list.push(p);
    map.set(p.group, list);
  }
  return map;
}