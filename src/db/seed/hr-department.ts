/**
 * Seed role HR + akun departemen HR (idempotent).
 * Jalankan: npx tsx --env-file=.env src/db/seed/hr-department.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, rolePermissions, users, userRoles } from "@/db/schema";
import { hash as argonHash } from "@node-rs/argon2";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id";
const HR_EMAIL = "madaniaqiqah.hr@gmail.com";
const HR_NAME = "Tim HR Madaniaqiqah";
const HR_PASSWORD = "hR7mK2pL9vW4nX8q";

const HR_PERMISSIONS = [
  "dashboard.*",
  "employees.*",
  "attendance.*",
  "kpi.*",
  "performance.*",
  "crm.*",
  "payroll.*",
  "kasbon.*",
];

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL.toLowerCase())).limit(1);
  if (!admin?.branchId) throw new Error("Admin utama belum ada, jalankan db:seed dulu");
  console.log("branch:", admin.branchId);

  // 1. Buat role HR jika belum ada
  let [role] = await db.select().from(roles).where(eq(roles.slug, "hr")).limit(1);
  if (!role) {
    const [r] = await db.insert(roles).values({
      slug: "hr",
      name: "Tim HR & Payroll",
      description: "Mengelola data karyawan, absensi, KPI, penggajian, dan kasbon.",
      isSystem: true,
    }).returning();
    role = r;
    console.log("role HR dibuat:", role.id);
  } else {
    console.log("role HR sudah ada:", role.id);
  }

  // 2. Grant permission HR (idempotent)
  const existing = await db.select({ permission: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  const have = new Set(existing.map((x) => x.permission));
  for (const perm of HR_PERMISSIONS) {
    if (have.has(perm)) {
      console.log("skip permission:", perm);
      continue;
    }
    await db.insert(rolePermissions).values({ roleId: role.id, permission: perm });
    console.log("grant permission:", perm);
  }

  // 3. Buat user HR jika belum ada
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, HR_EMAIL)).limit(1);
  if (exists.length > 0) {
    console.log("user HR sudah ada:", HR_EMAIL);
    process.exit(0);
  }

  const hash = await argonHash(HR_PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const [u] = await db.insert(users).values({
    email: HR_EMAIL,
    name: HR_NAME,
    passwordHash: hash,
    branchId: admin.branchId,
    isActive: true,
  }).returning({ id: users.id });
  await db.insert(userRoles).values({ userId: u.id, roleId: role.id });
  console.log("user HR dibuat:", HR_EMAIL, "→ role hr");
  console.log("password HR:", HR_PASSWORD);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
