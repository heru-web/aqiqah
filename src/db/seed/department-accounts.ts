/**
 * Seed akun departemen produksi (bukan demo, password asli).
 * Idempotent: jika email sudah ada, di-skip.
 * Jalankan: npx tsx --env-file=.env src/db/seed/department-accounts.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, roles, userRoles } from "@/db/schema";
import { hash as argonHash } from "@node-rs/argon2";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id";

const ACCOUNTS = [
  { email: "madaniaqiqah.superadmin@gmail.com", name: "Super Admin Madaniaqiqah", roleSlug: "superadmin", password: "rN6rGXhX3daQ3M" },
  { email: "madaniaqiqah.sales@gmail.com", name: "Tim Sales Madaniaqiqah", roleSlug: "sales", password: "bBwj283nYgN3eO" },
  { email: "madaniaqiqah.ops@gmail.com", name: "Tim Operasional Madaniaqiqah", roleSlug: "ops", password: "rjzBY7s0Z9Fv9p" },
  { email: "madaniaqiqah.acct@gmail.com", name: "Akuntan Madaniaqiqah", roleSlug: "acct", password: "0SPAyfuyPDjNCv" },
  { email: "madaniaqiqah.hr@gmail.com", name: "Tim HR Madaniaqiqah", roleSlug: "hr", password: "hR7mK2pL9vW4nX8q" },
  { email: "madaniaqiqah.marketing@gmail.com", name: "Tim Marketing Madaniaqiqah", roleSlug: "marketing", password: "mK4wQ8xT2vB7nJ5r" },
];

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL.toLowerCase())).limit(1);
  if (!admin?.branchId) throw new Error("Admin utama belum ada, jalankan db:seed dulu");
  console.log("branch:", admin.branchId);

  for (const a of ACCOUNTS) {
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, a.email)).limit(1);
    if (exists.length > 0) {
      console.log("skip (sudah ada):", a.email);
      continue;
    }
    const hash = await argonHash(a.password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const [u] = await db.insert(users).values({
      email: a.email,
      name: a.name,
      passwordHash: hash,
      branchId: admin.branchId,
      isActive: true,
    }).returning({ id: users.id });
    const [role] = await db.select().from(roles).where(eq(roles.slug, a.roleSlug)).limit(1);
    if (!role) throw new Error("Role tidak ditemukan: " + a.roleSlug);
    await db.insert(userRoles).values({ userId: u.id, roleId: role.id });
    console.log("dibuat:", a.email, "→ role", a.roleSlug);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
