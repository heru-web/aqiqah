import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { vouchers, voucherRedemptions, orders } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export const VOUCHER_TYPES = ["NOMINAL", "PERCENT", "FREE_DELIVERY"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export interface VoucherInput {
  code: string;
  type: VoucherType;
  nominalAmount?: bigint;
  percentBps?: number;
  maxUsage?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  isActive?: boolean;
}

export interface VoucherView {
  id: string;
  code: string;
  type: VoucherType;
  nominalAmount: bigint;
  percentBps: number;
  maxUsage: number | null;
  usedCount: number;
  remaining: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  state: "AKTIF" | "KOSONG" | "EXPIRED" | "BELUM_MULAI" | "NONAKTIF";
}

function isType(value: unknown): value is VoucherType {
  return typeof value === "string" && (VOUCHER_TYPES as readonly string[]).includes(value);
}

function stateOf(row: {
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxUsage: number | null;
  usedCount: number;
}): VoucherView["state"] {
  const now = Date.now();
  if (!row.isActive) return "NONAKTIF";
  if (row.startsAt && row.startsAt.getTime() > now) return "BELUM_MULAI";
  if (row.expiresAt && row.expiresAt.getTime() < now) return "EXPIRED";
  if (row.maxUsage !== null && row.usedCount >= row.maxUsage) return "KOSONG";
  return "AKTIF";
}

function normalize(input: VoucherInput) {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (code.length < 3) throw new ValidationError("Kode voucher minimal 3 karakter.");
  const type = input.type ?? "NOMINAL";
  if (!isType(type)) throw new ValidationError("Tipe voucher tidak valid.");
  const nominalAmount = input.nominalAmount ?? 0n;
  const percentBps = Math.round(input.percentBps ?? 0);
  if (nominalAmount < 0n) throw new ValidationError("Nilai nominal tidak boleh negatif.");
  if (percentBps < 0 || percentBps > 10000) throw new ValidationError("Persen harus antara 0 dan 100.");
  if (type === "NOMINAL" && nominalAmount <= 0n) throw new ValidationError("Voucher nominal butuh nilai > 0.");
  if (type === "PERCENT" && percentBps <= 0) throw new ValidationError("Voucher persen butuh nilai > 0.");
  if (input.maxUsage !== null && input.maxUsage !== undefined && input.maxUsage < 1) {
    throw new ValidationError("Maksimal pemakaian minimal 1 (kosongkan untuk tanpa batas).");
  }
  if (input.startsAt && input.expiresAt && input.expiresAt <= input.startsAt) {
    throw new ValidationError("Tanggal berakhir harus setelah tanggal mulai.");
  }
  return {
    code,
    type,
    nominalAmount,
    percentBps,
    maxUsage: input.maxUsage ?? null,
    startsAt: input.startsAt ?? null,
    expiresAt: input.expiresAt ?? null,
    isActive: input.isActive ?? true,
  };
}

export async function listVouchers(includeInactive = false): Promise<VoucherView[]> {
  const rows = await db
    .select()
    .from(vouchers)
    .where(includeInactive ? undefined : eq(vouchers.isActive, true))
    .orderBy(desc(vouchers.createdAt));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    nominalAmount: r.nominalAmount,
    percentBps: r.percentBps,
    maxUsage: r.maxUsage,
    usedCount: r.usedCount,
    remaining: r.maxUsage === null ? null : r.maxUsage - r.usedCount,
    startsAt: r.startsAt,
    expiresAt: r.expiresAt,
    isActive: r.isActive,
    state: stateOf(r),
  }));
}

export async function getVoucher(id: string) {
  const [row] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
  return row ?? null;
}

export async function voucherSummary() {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vouchers.isActive} = true)::int`,
      redeemed: sql<number>`coalesce(sum(${vouchers.usedCount}), 0)::int`,
    })
    .from(vouchers);
  return {
    total: Number(stats?.total ?? 0),
    active: Number(stats?.active ?? 0),
    redeemed: Number(stats?.redeemed ?? 0),
  };
}

export async function listRedemptions(voucherId: string, limit = 20) {
  const rows = await db
    .select({
      id: voucherRedemptions.id,
      orderId: voucherRedemptions.orderId,
      orderNumber: orders.orderNumber,
      amount: voucherRedemptions.amount,
      usedAt: voucherRedemptions.createdAt,
    })
    .from(voucherRedemptions)
    .leftJoin(orders, eq(voucherRedemptions.orderId, orders.id))
    .where(eq(voucherRedemptions.voucherId, voucherId))
    .orderBy(desc(voucherRedemptions.createdAt))
    .limit(limit);
  return rows;
}



/** Hapus voucher (bulk). Voucher yang terpakai tidak boleh dihapus. */
export async function deleteVouchers(ids: string[], actor: AuthUser): Promise<{ error?: string }> {
  const rows = await db.select().from(vouchers).where(inArray(vouchers.id, ids));
  const used = rows.filter((r) => r.usedCount > 0);
  if (used.length > 0) {
    return { error: "Voucher yang sudah terpakai tidak dihapus — non-aktifkan saja." };
  }
  await db.delete(vouchers).where(inArray(vouchers.id, ids));
  for (const r of rows) {
    await insertAudit(db, { actor, action: "DELETE", module: "products", entityType: "voucher", entityId: r.id, before: r });
  }
  return {};
}

export async function createVoucher(input: VoucherInput, actor: AuthUser): Promise<string> {
  const data = normalize(input);
  const existing = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.code, data.code)).limit(1);
  if (existing.length > 0) throw new ConflictError(`Kode "${data.code}" sudah dipakai.`);
  const [row] = await db.insert(vouchers).values(data).returning({ id: vouchers.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "products",
    entityType: "voucher",
    entityId: row.id,
    after: { ...data, nominalAmount: data.nominalAmount.toString() },
  });
  return row.id;
}

export async function updateVoucher(id: string, input: VoucherInput, actor: AuthUser): Promise<void> {
  const before = await getVoucher(id);
  if (!before) throw new NotFoundError("Voucher tidak ditemukan.");
  const data = normalize(input);
  const dup = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.code, data.code)).limit(1);
  if (dup.length > 0 && dup[0].id !== id) throw new ConflictError(`Kode "${data.code}" sudah dipakai voucher lain.`);
  await db
    .update(vouchers)
    .set({
      code: data.code,
      type: data.type,
      nominalAmount: data.nominalAmount,
      percentBps: data.percentBps,
      maxUsage: data.maxUsage,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      isActive: data.isActive,
    })
    .where(eq(vouchers.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "products",
    entityType: "voucher",
    entityId: id,
    before: { ...before, nominalAmount: before.nominalAmount.toString() },
    after: { ...data, nominalAmount: data.nominalAmount.toString() },
  });
}

export async function setVoucherActive(id: string, isActive: boolean, actor: AuthUser): Promise<void> {
  const before = await getVoucher(id);
  if (!before) throw new NotFoundError("Voucher tidak ditemukan.");
  await db.update(vouchers).set({ isActive }).where(eq(vouchers.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "products",
    entityType: "voucher",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive },
  });
}

export async function listVoucherCodesActive() {
  const now = new Date();
  const rows = await db
    .select({ code: vouchers.code, type: vouchers.type, nominalAmount: vouchers.nominalAmount, percentBps: vouchers.percentBps, expiresAt: vouchers.expiresAt })
    .from(vouchers)
    .where(eq(vouchers.isActive, true))
    .orderBy(asc(vouchers.code));
  return rows.filter((r) => !r.expiresAt || r.expiresAt > now);
}
