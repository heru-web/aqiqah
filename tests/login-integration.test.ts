import { describe, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { verify as argonVerify } from "@node-rs/argon2";
import { db } from "@/db";
import { rolePermissions, roles, sessions, userRoles, users } from "@/db/schema";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id").trim().toLowerCase();
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

describe("Login flow (live DB)", () => {
  it("admin user seeded & password dapat diverifikasi", async () => {
    const rows = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
    expect(rows.length, "admin user harus ada").toBe(1);
    const u = rows[0];
    expect(u.isActive).toBe(true);
    if (PASSWORD) {
      const ok = await argonVerify(u.passwordHash, PASSWORD);
      expect(ok, "password hash harus cocok dengan kredensial admin").toBe(true);
    }
  });

  it("role superadmin memberi wildcard permission", async () => {
    const roleIds = (
      await db.select({ roleId: userRoles.roleId }).from(userRoles)
    ).map((r) => r.roleId);
    const slugRows = await db.select({ slug: roles.slug }).from(roles).where(inArray(roles.id, roleIds));
    expect(slugRows.map((r) => r.slug)).toContain("superadmin");
    const perms = await db
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
    expect(perms.length, "superadmin harus punya permission").toBeGreaterThan(0);
    expect(perms.map((p) => p.permission)).toContain("*");
  });

  it("createSession inserts & loadUserByToken dapat menemukan sesi (simulasi)", async () => {
    const user = (await db.select().from(users).where(eq(users.email, EMAIL)).limit(1))[0];
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({ userId: user.id, tokenHash, expiresAt });
    const found = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    expect(found.length, "sesi harus tersimpan & ditemukan").toBe(1);

    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  });
});