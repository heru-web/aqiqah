/**
 * Seed dasar sistem (idempotent): branch pusat, role sistem, user admin,
 * bagan akun (COA) default, pengaturan aplikasi.
 *
 * Jalankan: npm run db:seed
 */
import { randomBytes } from "node:crypto";
import { hash as argonHash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  appMeta,
  appSettings,
  branches,
  cashAccounts,
  roles,
  rolePermissions,
  userRoles,
  users,
} from "@/db/schema";
import { ensurePerformanceSeed } from "./performance";

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id";
const GENERATED_PASSWORD = randomBytes(12).toString("base64url").replace(/[-_]/g, "X");
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? GENERATED_PASSWORD;

/** Harus konsisten dengan server/services/journal.ts COA. */
const COA_SEED: Array<{ code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"; group: string }> = [
  { code: "5-1210", name: "Beban Gaji", type: "EXPENSE", group: "Beban" },
  { code: "1-1320", name: "Piutang Karyawan", type: "ASSET", group: "Piutang" },
  { code: "1-1101", name: "Kas Besar", type: "ASSET", group: "Kas & Bank" },
  { code: "1-1102", name: "Kas Kecil", type: "ASSET", group: "Kas & Bank" },
  { code: "1-1120", name: "Bank BSI", type: "ASSET", group: "Kas & Bank" },
  { code: "1-1310", name: "Piutang Usaha", type: "ASSET", group: "Piutang" },
  { code: "1-1400", name: "Persediaan Barang", type: "ASSET", group: "Persediaan" },
  { code: "1-1410", name: "Persediaan Bahan Baku", type: "ASSET", group: "Persediaan" },
  { code: "2-1300", name: "Hutang Usaha", type: "LIABILITY", group: "Hutang" },
  { code: "3-1100", name: "Modal Usaha", type: "EQUITY", group: "Modal" },
  { code: "4-1110", name: "Pendapatan Penjualan", type: "INCOME", group: "Pendapatan" },
  { code: "4-2100", name: "Pendapatan Lain-lain", type: "INCOME", group: "Pendapatan" },
  { code: "5-1200", name: "Beban Umum & Administrasi", type: "EXPENSE", group: "Beban" },
  { code: "5-1410", name: "Harga Pokok Penjualan", type: "EXPENSE", group: "Beban" },
];

interface RoleDef {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

const ROLES: RoleDef[] = [
  {
    slug: "superadmin",
    name: "Super Admin",
    description: "Akses penuh ke seluruh sistem (sistem).",
    permissions: ["*"],
  },
  {
    slug: "sales",
    name: "Tim Sales",
    description: "FAQ & order: lead, penawaran, pesanan, invoice, pembayaran.",
    permissions: [
      "dashboard.*",
      "crm.*",
      "customers.*",
      "products.*",
      "quotations.*",
      "orders.*",
      "invoices.*",
      "payments.*",
      "notifications.*",
    ],
  },
  {
    slug: "ops",
    name: "Tim Operasional",
    description: "Produksi, inventaris, pengiriman, karyawan, absensi, kinerja.",
    permissions: [
      "dashboard.*",
      "orders.*",
      "production.*",
      "inventory.*",
      "delivery.*",
      "employees.*",
      "attendance.*",
      "payroll.*",
      "kasbon.*",
      "performance.*",
      "crm.*",
      "notifications.*",
    ],
  },
  {
    slug: "acct",
    name: "Akuntan",
    description: "Cash & bank, piutang/hutang, jurnal, COA, HPP, laporan, ZISWAF.",
    permissions: [
      "dashboard.*",
      "cash.*",
      "receivables.*",
      "payables.*",
      "accounting.*",
      "coa.*",
      "hpp.*",
      "reconciliation.*",
      "reports.*",
      "ziswaf.*",
      "crm.*",
      "notifications.*",
    ],
  },  {
    slug: "marketing",
    name: "Tim Marketing",
    description: "Monitoring lead CRM: intake, follow-up, dan konversi prospek.",
    permissions: [
      "dashboard.*",
      "crm.*",
      "customers.*",
      "notifications.*",
    ],
  },
];

async function ensureBranch(): Promise<string> {
  const existing = await db.select().from(branches).where(eq(branches.code, "PUSAT")).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [row] = await db
    .insert(branches)
    .values({
      code: "PUSAT",
      name: "Madani Aqiqah Pusat",
      city: "Bandung",
      isActive: true,
    })
    .returning({ id: branches.id });
  console.log(`  + Branch ${row.id} (PUSAT)`);
  return row.id;
}

async function ensureRoles(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const def of ROLES) {
    const existing = await db.select().from(roles).where(eq(roles.slug, def.slug)).limit(1);
    if (existing.length > 0) {
      out[def.slug] = existing[0].id;
      continue;
    }
    const [row] = await db
      .insert(roles)
      .values({
        slug: def.slug,
        name: def.name,
        description: def.description,
        isSystem: true,
      })
      .returning({ id: roles.id });
    for (const permission of def.permissions) {
      await db
        .insert(rolePermissions)
        .values({ roleId: row.id, permission })
        .onConflictDoNothing();
    }
    out[def.slug] = row.id;
    console.log(`  + Role ${def.slug} (${def.permissions.length} permission)`);
  }
  return out;
}

async function ensureAdmin(roleIds: Record<string, string>, branchId: string): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.email, SEED_ADMIN_EMAIL.toLowerCase())).limit(1);
  if (existing.length > 0) {
    console.log(`  = Admin ${SEED_ADMIN_EMAIL} sudah ada, dilewati.`);
    return;
  }

  const passwordHash = await argonHash(SEED_ADMIN_PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const [row] = await db
    .insert(users)
    .values({
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      name: "Administrator",
      passwordHash,
      branchId,
      isActive: true,
    })
    .returning({ id: users.id });

  await db.insert(userRoles).values({ userId: row.id, roleId: roleIds.superadmin });
  console.log(`  + Admin ${SEED_ADMIN_EMAIL}`);
}

async function ensureCoa(): Promise<void> {
  for (const c of COA_SEED) {
    const existing = await db.select().from(accounts).where(eq(accounts.code, c.code)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(accounts).values({
      code: c.code,
      name: c.name,
      type: c.type,
      group: c.group,
      isPostable: true,
      isActive: true,
      isSystem: true,
      openingBalance: 0n,
    });
  }
  console.log(`  + COA (${COA_SEED.length} akun)`);
}

async function ensureCashAccounts(branchId: string): Promise<void> {
  const existing = await db.select().from(cashAccounts).where(eq(cashAccounts.name, "Bank BSI")).limit(1);
  if (existing.length > 0) return;
  await db.insert(cashAccounts).values({
    branchId,
    name: "Bank BSI",
    type: "BANK",
    bankName: "Bank Syariah Indonesia",
    accountNumber: "",
    openingBalance: 0n,
    isActive: true,
  });
  console.log("  + Kas/Bank: Bank BSI");
}

async function ensureSettings(): Promise<void> {
  const defaults: Array<{ key: string; value: unknown }> = [
    { key: "company.name", value: "Madani Aqiqah" },
    { key: "company.tagline", value: "Aqiqah Amanah, Tersedia Door to Door" },
    { key: "currency.code", value: "IDR" },
    { key: "delivery.defaultNote", value: "Siapkan daging aqiqah dengan rincian sesuai pesanan." },
  ];
  for (const d of defaults) {
    await db.insert(appSettings).values({ key: d.key, value: d.value }).onConflictDoNothing();
  }
  console.log(`  + AppSettings (${defaults.length} kunci)`);
}

async function main(): Promise<void> {
  console.log("Seed Madani Aqiqah V3");
  console.log("Kredensial admin:");

  const branchId = await ensureBranch();
  const roleIds = await ensureRoles();
  await ensureAdmin(roleIds, branchId);
  await ensureCoa();
  await ensureCashAccounts(branchId);
  await ensureSettings();
  await ensurePerformanceSeed();

  await db
    .insert(appMeta)
    .values({
      key: "seed.info",
      value: { schemaVersion: 1, phase: 2, migratedAt: new Date().toISOString() },
    })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: { schemaVersion: 1, phase: 2 } } });

  if (SEED_ADMIN_PASSWORD === GENERATED_PASSWORD) {
    console.log(`Email    : ${SEED_ADMIN_EMAIL}`);
    console.log(`Password : ${SEED_ADMIN_PASSWORD}`);
    console.log("Set SEED_ADMIN_PASSWORD saat menjalankan seed untuk kredensial tetap.");
  }
  console.log("Selesai.");
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed gagal:", err);
    process.exit(1);
  });