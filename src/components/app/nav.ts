import {
  BanknoteIcon,
  BookOpenCheckIcon,
  BookOpenIcon,
  BoxesIcon,
  CalendarDaysIcon,
  ChefHatIcon,
  CircleUserIcon,
  ClipboardListIcon,
  CoinsIcon,
  CreditCardIcon,
  FileBarChart2Icon,
  FileSpreadsheetIcon,
  HandCoinsIcon,
  HeartHandshakeIcon,
  HouseIcon,
  LineChartIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PercentIcon,
  PhoneCallIcon,
  ReceiptIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  TruckIcon,
  Users2Icon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  TargetIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  CalendarFoldIcon,
  ContactRoundIcon,
  MessageSquareWarningIcon,
  MessageCircleIcon,
  TicketIcon,
  PawPrintIcon,
  type LucideIcon,
} from "lucide-react";
import { moduleGroupColor } from "@/lib/module-colors";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Modul yang belum diimplementasikan → placeholder. */
  module?: string;
  /** Module permission RBAC yang mengatur visibilitas menu. Tanpa perm = universal. */
  perm?: string;
}

export interface NavGroup {
  group: string;
  /** Warna aksen label grup (meniru palet Jurnal Guru). */
  color: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Utama",
    color: moduleGroupColor("Utama"),
    items: [
      { href: "/dashboard", label: "Dasbor", icon: HouseIcon },
      { href: "/docs", label: "Dokumentasi", icon: BookOpenIcon },
    ],
  },
  {
    group: "Penjualan",
    color: moduleGroupColor("Penjualan"),
    items: [
      { href: "/crm", label: "CRM / Prospek", icon: PhoneCallIcon, perm: "crm" },
      { href: "/crm/contacts", label: "Kontak CRM", icon: ContactRoundIcon, perm: "crm" },
      { href: "/crm/activities", label: "Aktivitas CRM", icon: CalendarClockIcon, perm: "crm" },
      { href: "/whatsapp", label: "WhatsApp Center", icon: MessageCircleIcon, perm: "crm" },
      { href: "/complaints", label: "Keluhan Pelanggan", icon: MessageSquareWarningIcon, perm: "crm" },
      { href: "/customers", label: "Pelanggan", icon: Users2Icon, perm: "customers" },
      { href: "/quotations", label: "Penawaran", icon: FileBarChart2Icon, perm: "quotations" },
      { href: "/orders", label: "Pesanan", icon: ClipboardListIcon, perm: "orders" },
      { href: "/invoices", label: "Tagihan", icon: ReceiptIcon, perm: "invoices" },
      { href: "/payments", label: "Pembayaran", icon: WalletIcon, perm: "payments" },
      { href: "/vouchers", label: "Voucher", icon: TicketIcon, perm: "products" },
    ],
  },
  {
    group: "Operasional",
    color: moduleGroupColor("Operasional"),
    items: [
      { href: "/production", label: "Produksi", icon: ChefHatIcon, module: "production", perm: "production" },
      { href: "/inventory", label: "Inventaris", icon: WarehouseIcon, module: "inventory", perm: "inventory" },
      { href: "/suppliers", label: "Supplier", icon: ContactRoundIcon, module: "inventory", perm: "inventory.procurement" },
      { href: "/animals", label: "Hewan Ternak", icon: PawPrintIcon, module: "inventory", perm: "inventory.stock" },
      { href: "/delivery", label: "Pengiriman", icon: TruckIcon, module: "delivery", perm: "delivery" },
    ],
  },
  {
    group: "Kepegawaian",
    color: moduleGroupColor("Kepegawaian"),
    items: [
      { href: "/karyawan", label: "Karyawan", icon: UsersIcon, perm: "employees" },
      { href: "/attendance", label: "Absensi", icon: CalendarDaysIcon, perm: "attendance" },
      { href: "/payroll", label: "Penggajian", icon: BanknoteIcon, module: "payroll", perm: "payroll" },
      { href: "/kasbon", label: "Kasbon", icon: HandCoinsIcon, module: "kasbon", perm: "kasbon" },
    ],
  },
  {
    group: "Manajemen Kinerja",
    color: moduleGroupColor("Manajemen Kinerja"),
    items: [
      { href: "/kinerja", label: "Dasbor Kinerja", icon: LineChartIcon, perm: "performance" },
      { href: "/kinerja/harian", label: "Scorecard Harian", icon: CalendarCheckIcon, perm: "performance" },
      { href: "/kinerja/mingguan", label: "Review Mingguan", icon: CalendarRangeIcon, perm: "performance" },
      { href: "/kinerja/bulanan", label: "Review Bulanan", icon: CalendarFoldIcon, perm: "performance" },
      { href: "/kinerja/pengaturan", label: "Pengaturan KPI", icon: TargetIcon, perm: "performance" },
      { href: "/kinerja/marketing", label: "Iklan & Kampanye", icon: MegaphoneIcon, perm: "performance" },
    ],
  },
  {
    group: "Keuangan & Akuntansi",
    color: moduleGroupColor("Keuangan & Akuntansi"),
    items: [
      { href: "/cash", label: "Kas & Bank", icon: CoinsIcon, module: "cash", perm: "cash" },
      { href: "/receivables", label: "Piutang", icon: CreditCardIcon, module: "receivables", perm: "receivables" },
      { href: "/payables", label: "Hutang", icon: PercentIcon, module: "payables", perm: "payables" },
      { href: "/accounting", label: "Akuntansi", icon: BookOpenCheckIcon, module: "accounting", perm: "accounting" },
      { href: "/coa", label: "Bagan Akun", icon: ListChecksIcon, module: "coa", perm: "coa" },
      { href: "/reports", label: "Laporan", icon: FileSpreadsheetIcon, module: "reports", perm: "reports" },
    ],
  },
  {
    group: "Program Sosial",
    color: moduleGroupColor("Program Sosial"),
    items: [{ href: "/ziswaf", label: "ZISWAF", icon: HeartHandshakeIcon, module: "ziswaf", perm: "ziswaf" }],
  },
  {
    group: "Sistem",
    color: moduleGroupColor("Sistem"),
    items: [
      { href: "/users", label: "Pengguna", icon: CircleUserIcon, perm: "users" },
      { href: "/roles", label: "Peran & Hak Akses", icon: ShieldCheckIcon, perm: "roles" },
      { href: "/branches", label: "Cabang", icon: BoxesIcon, perm: "branches" },
      { href: "/settings", label: "Pengaturan", icon: Settings2Icon, perm: "settings" },
      { href: "/broadcast", label: "Broadcast WA", icon: MegaphoneIcon, perm: "notifications" },
      { href: "/audit", label: "Log Audit", icon: ScrollTextIcon, perm: "audit" },
    ],
  },
];

export function findNavItem(href: string): NavItem | undefined {
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.href === href);
    if (item) return item;
  }
  return undefined;
}

/** Daftar href menu yang boleh diakses berdasar permission user. Tanpa perm = universal. */
export function getAllowedMenuHrefs(permissions: string[]): string[] {
  const out: string[] = [];
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (!item.perm || permissions.some((permission) =>
        permission === "*" ||
        ((permission === `${item.perm}.*` || permission.startsWith(`${item.perm}.`)) &&
          (permission.endsWith(".view") || permission.endsWith(".*")))
      )) out.push(item.href);
    }
  }
  return out;
}

export const PLACEHOLDER_MODULES: Record<string, { title: string; description: string; steps: string[] }> = {
  production: {
    title: "Produksi",
    description: "Manajemen batch produksi: penyembelihan, karkas/fillet, masak, packing, dan QC.",
    steps: [
      "Anti-curang: tim penyembelihan tanpa akses ke data pesanan (anti fraud acak-pilih hewan).",
      "Foto & video RPH per proses; tracking batch hewan → masakan.",
      "QC checklist tersimpan dan bisa dicetak (bukti kepatuhan syariah).",
    ],
  },
  inventory: {
    title: "Inventaris",
    description: "Persediaan hewan RPH, bahan dapur, dan stok olahan dengan ledger FIFO.",
    steps: [
      "Ledger inventory FIFO: masuk (panen/beli) → produksi → keluar (jual/pakai).",
      "Sinkron stok otomatis saat produksi & pengiriman.",
      "Adjustment & stock opname dengan approval.",
    ],
  },
  delivery: {
    title: "Pengiriman",
    description: "Rute door-to-door, kurir, kendaraan, dan bukti terima (POD).",
    steps: [
      "Terima residu pengiriman dari order (READY_DISPATCH → DELIVERED).",
      "POD digital + foto: relawan/kurir/kendaraan, batas pasar malam.",
      "Status pengiriman dan timeline realtime.",
    ],
  },
  employees: {
    title: "Karyawan",
    description: "Data karyawan, jabatan, dan penempatan cabang.",
    steps: [
      "Master karyawan (karyawan + relawan + ustadz pengajian).",
      "Kontrak, jabatan, dan lampiran dokumen.",
    ],
  },
  attendance: {
    title: "Absensi",
    description: "Kalkulasi kehadiran untuk payroll.",
    steps: [
      "Absensi harian per shift (masuk/keluar, lembur).",
      "Rekap bulanan yang tersinkron ke payroll.",
    ],
  },
  kpi: {
    title: "KPI",
    description: "Indikator kinerja tim (lead response, on-time delivery, word-of-mouth).",
    steps: [
      "KPI berbasis data nyata (bukan estimasi).",
      "Grafik per tim/individu.",
    ],
  },
  payroll: {
    title: "Penggajian",
    description: "Slip gaji, komponen THR/Bonus, dan transaksi H2H.",
    steps: [
      "Komponen gaji dasar + insentif (dari KPI).",
      "Slip online & rekapitulasi jurnal PAYROLL.",
    ],
  },
  kasbon: {
    title: "Kasbon",
    description: "Pinjaman karyawan dengan cicilan dari gaji.",
    steps: [
      "Ajuan kasbon + approval berjenjang.",
      "Cicilan otomatis terpotong payroll.",
    ],
  },
  cash: {
    title: "Kas & Bank",
    description: "Kasir, rekonsiliasi, dan transfer antar kas.",
    steps: [
      "Kas masuk/keluar harian + jurnal kas.",
      "Rekonsiliasi bank & mutasi rekening.",
    ],
  },
  receivables: {
    title: "Piutang",
    description: "Aging piutang per pelanggan dan follow-up otomatis.",
    steps: [
      "Aging 0-30/31-60/60+ hari.",
      "Pengingat WA otomatis & provisi BAD_DEBT.",
    ],
  },
  payables: {
    title: "Hutang",
    description: "Hutang ke supplier (RPH, dapur, logistik).",
    steps: [
      "Pencatatan faktur supplier + jatuh tempo.",
      "Pembayaran & rekonsiliasi.",
    ],
  },
  accounting: {
    title: "Akuntansi",
    description: "Buku besar, jurnal, dan laporan keuangan syariah.",
    steps: [
      "Jurnal otomatis dari order/payment/batch produksi.",
      "Neraca & laba rugi (basis akrual).",
    ],
  },
  coa: {
    title: "Bagan Akun",
    description: "Kelola bagan akun (COA) dan saldo awal.",
    steps: [
      "CRUD COA + tipe akun (Neraca/Laba-rugi).",
      "Saldo awal pada pembukaan periode.",
    ],
  },
  reports: {
    title: "Laporan",
    description: "Rekap harian, ekspor Excel/PDF, dan snapshot periode.",
    steps: [
      "Rekap operasional (materai & dokumen singkat).",
      "Ekspor Excel/PDF + snapshot laporan periode lalu.",
    ],
  },
  ziswaf: {
    title: "ZISWAF",
    description: "Transparansi Zakat, Infak, Sedekah, dan Wakaf.",
    steps: [
      "Pencatatan dana ZISWAF penerimaan & penyaluran.",
      "Laporan transparan untuk donatur & lembaga amil.",
    ],
  },
};