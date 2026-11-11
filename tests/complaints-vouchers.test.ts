import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, branches, customerComplaints, users, vouchers, voucherRedemptions } from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";
import { createComplaint, listComplaints, setComplaintStatus, complaintSummary } from "@/server/services/complaints";
import { createVoucher, listVouchers, updateVoucher, setVoucherActive, voucherSummary, listRedemptions } from "@/server/services/vouchers";

const created = { voucherId: "", complaintId: "", branchId: "" };

async function adminActor(): Promise<AuthUser> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id").trim().toLowerCase();
  const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
  if (!branch) throw new Error("cabang tidak ditemukan");
  created.branchId = branch.id;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("admin user tidak ditemukan");
  return {
    id: user.id,
    email,
    name: user.name,
    branchId: branch.id,
    roles: ["superadmin"],
    permissions: ["*"],
  };
}

afterAll(async () => {
  if (created.complaintId) {
    await db.delete(customerComplaints).where(eq(customerComplaints.id, created.complaintId));
  }
  if (created.voucherId) {
    await db.delete(voucherRedemptions).where(eq(voucherRedemptions.voucherId, created.voucherId));
    await db.delete(vouchers).where(eq(vouchers.id, created.voucherId));
  }
  const ids = [created.complaintId, created.voucherId].filter(Boolean);
  if (ids.length > 0) await db.delete(auditLogs).where(inArray(auditLogs.entityId, ids));
});

describe("Modul keluhan & voucher (live DB)", () => {
  it("mencatat keluhan alur BARU→SELESAI dan membuat voucher tersedia", async () => {
    const actor = await adminActor();
    const suffix = Date.now().toString(36).toUpperCase();

    created.complaintId = await createComplaint(
      {
        branchId: created.branchId,
        channel: "WA",
        category: "PORSI",
        severity: "TINGGI",
        description: `Uji keluhan ${suffix} porsi kurang`,
      },
      actor
    );

    const rows = await listComplaints({ branchId: created.branchId });
    const found = rows.find((r) => r.id === created.complaintId);
    expect(found?.description).toContain(suffix);
    expect(found?.severity).toBe("TINGGI");
    expect(found?.status).toBe("BARU");

    const beforeSummary = await complaintSummary(created.branchId);
    expect(beforeSummary.total).toBeGreaterThan(0);

    await setComplaintStatus(created.complaintId, "DIPROSES", "Ditingkatkan ke tim dapur", actor);
    const recheck = await listComplaints({ branchId: created.branchId });
    const after = recheck.find((r) => r.id === created.complaintId);
    expect(after?.status).toBe("DIPROSES");

    await setComplaintStatus(created.complaintId, "SELESAI", "Porsi ditambah + appologize", actor);
    const done = (await listComplaints({ branchId: created.branchId })).find((r) => r.id === created.complaintId);
    expect(done?.status).toBe("SELESAI");
    expect(done?.resolvedAt).not.toBeNull();

    created.voucherId = await createVoucher(
      {
        code: `UJI${suffix}`,
        type: "PERCENT",
        percentBps: 1000,
        maxUsage: 5,
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
      actor
    );
    const vouchers_ = await listVouchers(true);
    const v = vouchers_.find((x) => x.id === created.voucherId)!;
    expect(v.state).toBe("AKTIF");
    expect(v.percentBps).toBe(1000);
    expect(v.remaining).toBe(5);

    await updateVoucher(created.voucherId, { code: `UJI${suffix}`, type: "NOMINAL", nominalAmount: 50_000n, isActive: true }, actor);
    const updated = (await listVouchers(true)).find((x) => x.id === created.voucherId)!;
    expect(updated.type).toBe("NOMINAL");
    expect(updated.nominalAmount).toBe(50_000n);

    await setVoucherActive(created.voucherId, false, actor);
    const inactive = (await listVouchers(true)).find((x) => x.id === created.voucherId)!;
    expect(inactive.state).toBe("NONAKTIF");
    const all = await listVouchers(false);
    expect(all.some((x) => x.id === created.voucherId)).toBe(false);

    const redemptions = await listRedemptions(created.voucherId);
    expect(redemptions).toHaveLength(0);

    const summary = await voucherSummary();
    expect(summary.total).toBeGreaterThan(0);
  });
});
