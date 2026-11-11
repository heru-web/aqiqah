/**
 * Seed role Marketing + akun departemen Marketing, dan grant akses CRM
 * ke role ops/acct/hr (idempotent).
 * Jalankan: npx tsx --env-file=.env src/db/seed/marketing-crm.ts
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { roles, rolePermissions, users, userRoles } from "@/db/schema";
import { hash as argonHash } from "@node-rs/argon2";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id";
const MKT_EMAIL = "madaniaqiqah.marketing@gmail.com";
const MKT_NAME = "Tim Marketing Madaniaqiqah";
const MKT_PASSWORD = "mK4wQ8xT2vB7nJ5r";

const MKT_PERMISSIONS = [
  "dashboard.*",
  "crm.*",
  "customers.*",
  "notifications.*",
];

const CRM_GRANT_SLUGS = ["ops", "acct", "hr"];

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL.toLowerCase())).limit(1);
  if (!admin?.branchId) throw new Error("Admin utama belum ada, jalankan db:seed dulu");
  console.log("branch:", admin.branchId);

  // 1. Role marketing
  let [mktRole] = await db.select().from(roles).where(eq(roles.slug, "marketing")).limit(1);
  if (!mktRole) {
    const [r] = await db.insert(roles).values({
      slug: "marketing",
      name: "Tim Marketing",
      description: "Monitoring lead CRM: intake, follow-up, dan konversi prospek.",
      isSystem: true,
    }).returning();
    mktRole = r;
    console.log("role marketing dibuat:", mktRole.id);
  } else {
    console.log("role marketing sudah ada:", mktRole.id);
  }

  // 2. Permission marketing
  const existing = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, mktRole.id));
  const have = new Set(existing.map((x) => x.permission));
  for (const perm of MKT_PERMISSIONS) {
    if (have.has(perm)) {
      console.log("skip permission:", perm);
      continue;
    }
    await db.insert(rolePermissions).values({ roleId: mktRole.id, permission: perm });
    console.log("grant permission marketing:", perm);
  }

  // 3. Grant crm.* ke role eksisting (ops, acct, hr)
  const grantRoles = await db.select().from(roles).where(inArray(roles.slug, CRM_GRANT_SLUGS));
  for (const role of grantRoles) {
    const perms = await db
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    if (!perms.some((p) => p.permission === "crm.*")) {
      await db.insert(rolePermissions).values({ roleId: role.id, permission: "crm.*" });
      console.log("grant crm.* →", role.slug);
    } else {
      console.log("skip crm.* (sudah ada) →", role.slug);
    }
  }

  // 4. User marketing
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, MKT_EMAIL)).limit(1);
  if (exists.length > 0) {
    console.log("user marketing sudah ada:", MKT_EMAIL);
    process.exit(0);
  }
  const hash = await argonHash(MKT_PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const [u] = await db
    .insert(users)
    .values({
      email: MKT_EMAIL,
      name: MKT_NAME,
      passwordHash: hash,
      branchId: admin.branchId,
      isActive: true,
    })
    .returning({ id: users.id });
  await db.insert(userRoles).values({ userId: u.id, roleId: mktRole.id });
  console.log("user marketing dibuat:", MKT_EMAIL, "→ role marketing");
  console.log("password marketing:", MKT_PASSWORD);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
