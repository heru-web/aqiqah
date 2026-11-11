import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, auditLogs, branches, users } from "@/db/schema";
import { postJournal } from "@/server/services/journal";
import { closePeriod, isPeriodClosed, reopenPeriod } from "@/server/services/periods";
import type { AuthUser } from "@/lib/server/auth";

const created = { closingId: "", auditIds: [] as string[] };
const PERIOD = "2099-01";
const DAY = new Date("2099-01-05T10:00:00Z");
const actor: Promise<AuthUser> = (async () => {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id").trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
  if (!user || !branch) throw new Error("data uji tidak lengkap");
  return { id: user.id, email: user.email, name: user.name, branchId: branch.id, roles: ["superadmin"], permissions: ["*"] };
})();

afterAll(async () => {
  if (created.closingId) {
    await db.delete(auditLogs).where(inArray(auditLogs.entityId, [created.closingId, ...created.auditIds]));
  }
});

describe("Penutupan periode akuntansi", () => {
  it("menutup periode, menolak posting jurnal, dan bisa dibuka ulang", async () => {
    const a = await actor;
    expect(await isPeriodClosed(PERIOD)).toBe(false);

    created.closingId = await closePeriod(PERIOD, "uji Periode ditutup", a);
    expect(await isPeriodClosed(PERIOD)).toBe(true);

    const accts = await db.select().from(accounts).where(eq(accounts.isActive, true)).limit(2);
    expect(accts.length).toBe(2);
    let threw = "";
    try {
      await postJournal({
        exec: db,
        branchId: a.branchId ?? "",
        type: "ADJUSTMENT",
        journalDate: DAY,
        description: "uji jurnal periode tertutup",
        sourceModule: "test",
        sourceEntityType: "",
        sourceEntityId: "",
        lines: [
          { accountCode: accts[0].code, debit: 5_000n, credit: 0n, description: "d" },
          { accountCode: accts[1].code, debit: 0n, credit: 5_000n, description: "k" },
        ],
        actor: a,
      });
    } catch (err) {
      threw = String(err);
    }
    expect(threw).toContain("ditutup");

    await reopenPeriod(created.closingId, "uji buka ulang", a);
    expect(await isPeriodClosed(PERIOD)).toBe(false);
  });
});
