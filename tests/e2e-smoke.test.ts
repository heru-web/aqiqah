import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const BASE = process.env.E2E_TARGET ?? "http://127.0.0.1:3100";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const cookieJar = { value: "" };
let serverUp = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(3000) });
    serverUp = res.status === 200;
  } catch {
    serverUp = false;
  }
});

afterAll(async () => {
  if (cookieJar.value) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(cookieJar.value)));
  }
});

/** Bantuan: buat sesi superadmin & set cookie ala login. */
async function loginAsSuperadmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id").trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("admin user tidak ditemukan");
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  cookieJar.value = token;
}

describe("Smoke E2E HTTP (butuh server aktif)", () => {
  it("root redirect ke /login", async (ctx) => {
    if (!serverUp) { ctx.skip(); return; }
    const res = await fetch(`${BASE}/`, { redirect: "manual" });
    expect([307, 302]).toContain(res.status);
    expect(res.headers.get("location") ?? "").toContain("/login");
  });

  it("halaman login render", async (ctx) => {
    if (!serverUp) { ctx.skip(); return; }
    const res = await fetch(`${BASE}/login`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Madani Aqiqah");
  });

  it("halaman terproteksi 307 selama belum login", async (ctx) => {
    if (!serverUp) { ctx.skip(); return; }
    for (const path of ["/suppliers", "/animals", "/reports"]) {
      const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
      expect([307, 302]).toContain(res.status);
    }
  });

  it("dengan session: dashboard & modul inti 200", async (ctx) => {
    if (!serverUp) { ctx.skip(); return; }
    await loginAsSuperadmin();
    for (const path of ["/dashboard", "/suppliers", "/animals", "/complaints", "/vouchers", "/reports", "/delivery"]) {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Cookie: `ma3_session=${cookieJar.value}` },
        redirect: "manual",
      });
      expect(res.status, `${path} harus 200`).toBe(200);
    }
  });

  it("PWA manifest terlayani", async (ctx) => {
    if (!serverUp) { ctx.skip(); return; }
    const res = await fetch(`${BASE}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"short_name"');
  });
});
