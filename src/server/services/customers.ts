import "server-only";
import { resolveBranch } from "@/lib/branch-access";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import { nextSequentialNumber } from "@/lib/server/sequences";
import type { AuthUser } from "@/lib/server/auth";
import { sendWhatsapp } from "@/server/services/whatsapp";
import { customerCreateSchema, customerUpdateSchema, type CustomerCreateInput } from "@/server/schemas";

export async function createCustomer(input: CustomerCreateInput, actor: AuthUser): Promise<string> {
  const parsed = customerCreateSchema.parse(input);
  const branchId = resolveBranch(actor, parsed.branchId);
  if (!branchId) throw new ConflictError("Branch belum diatur untuk user.");

  const code = await nextSequentialNumber("CST", { pad: 4 });
  const [row] = await db
    .insert(customers)
    .values({
      branchId,
      code,
      name: parsed.name,
      type: parsed.type,
      phone: parsed.phone ?? null,
      whatsapp: parsed.whatsapp ?? null,
      email: parsed.email || null,
      address: parsed.address ?? null,
      city: parsed.city ?? null,
      province: parsed.province ?? null,
      npwp: parsed.npwp ?? null,
      source: parsed.source ?? null,
      notes: parsed.notes ?? null,
      ayahName: parsed.ayahName ?? null,
      ibuName: parsed.ibuName ?? null,
      birthPlace: parsed.birthPlace ?? null,
      birthDate: parsed.birthDate || null,
      packageName: parsed.packageName ?? null,
      deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : null,
      deliverySlot: parsed.deliverySlot ?? null,
      consent: parsed.consent ?? null,
      createdBy: actor.id,
    })
    .returning({ id: customers.id });

  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "customers",
    entityType: "customer",
    entityId: row.id,
    after: { code, name: parsed.name },
  });
  return row.id;
}

export async function updateCustomer(id: string, input: Partial<CustomerCreateInput>, actor: AuthUser): Promise<string> {
  const parsed = customerUpdateSchema.parse(input);
  const before = await requireCustomer(id);
  const rows = await db
    .update(customers)
    .set({
      name: parsed.name,
      type: parsed.type,
      phone: parsed.phone ?? null,
      whatsapp: parsed.whatsapp ?? null,
      email: parsed.email || null,
      address: parsed.address ?? null,
      city: parsed.city ?? null,
      province: parsed.province ?? null,
      npwp: parsed.npwp ?? null,
      source: parsed.source ?? null,
      notes: parsed.notes ?? null,
      ayahName: parsed.ayahName ?? null,
      ibuName: parsed.ibuName ?? null,
      birthPlace: parsed.birthPlace ?? null,
      birthDate: parsed.birthDate || null,
      packageName: parsed.packageName ?? null,
      deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : null,
      deliverySlot: parsed.deliverySlot ?? null,
      consent: parsed.consent ?? null,
    })
    .where(eq(customers.id, id))
    .returning({ id: customers.id });
  if (rows.length === 0) throw new NotFoundError("Pelanggan tidak ditemukan.");
  const customerId = rows[0].id;

  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "customers",
    entityType: "customer",
    entityId: id,
    before: { name: before.name, phone: before.phone },
    after: { name: parsed.name ?? before.name },
  });
  return customerId;
}

export async function archiveCustomer(id: string, actor: AuthUser): Promise<string> {
  const before = await requireCustomer(id);
  await db.update(customers).set({ isActive: false }).where(eq(customers.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "customers",
    entityType: "customer",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive: false },
  });
  return id;
}


export async function bulkArchiveCustomers(ids: string[], actor: AuthUser): Promise<{ error?: string }> {
  const found = await db.select({ id: customers.id }).from(customers).where(inArray(customers.id, ids));
  const foundIds = new Set(found.map((f) => f.id));
  const toArchive = ids.filter((id) => foundIds.has(id));
  for (const id of toArchive) {
    await archiveCustomer(id, actor);
  }
  if (toArchive.length > 0) {
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: "customers",
      entityType: "customer",
      entityId: toArchive[0],
      after: { bulkArchive: true, ids: toArchive },
    });
  }
  return {};
}

export async function listCustomers(opts: { branchId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const { search, page = 1, pageSize = 20 } = opts;
  const branchId = opts.branchId ?? undefined;

  const conditions = [isNull(customers.deletedAt)];
  if (branchId) conditions.push(eq(customers.branchId, branchId));
  if (search) conditions.push(sql`(${customers.name} ILIKE ${`%${search}%`} OR ${customers.phone} ILIKE ${`%${search}%`} OR ${customers.code} ILIKE ${`%${search}%`})`);

  const where = and(...conditions);
  const [rows, [{ count: total }]] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(customers).where(where),
  ]);
  return { rows, total: Number(total), page, pageSize };
}

export async function requireCustomer(id: string) {
  const row = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (row.length === 0) throw new NotFoundError("Pelanggan tidak ditemukan.");
  return row[0];
}
/** Susun pesan konfirmasi "Alhamdulillah Barakallah" dari data pelanggan. */
export function buildCustomerConfirmationMessage(c: typeof customers.$inferSelect): string {
  const d = (date: unknown): string => {
    if (!date) return "";
    const dt = new Date(String(date));
    return dt.toISOString().slice(0, 10).split("-").reverse().join("-"); // DD-MM-YYYY
  };
  const nama = c.name ?? "";
  const consentRaw = (c.consent ?? "").trim();
  const consent = consentRaw
    ? consentRaw.replace(/\n/g, ", ")
    : "boleh foto & video, boleh publikasi";

  const lines = [
    "Alhamdulillah Barakallah..",
    "",
    "Terimakasih AyahBunda telah mempercayakan pelaksanaan Aqiqah bersama MADANI AQIQAH & CATERING",
    "___",
    "",
    "Mohon Diisi Data berikut :",
    `Nama yg di aqiqah: ${nama}`,
    `Nama Ayah : ${c.ayahName ?? "-"}`,
    `Nama Ibu : ${c.ibuName ?? "-"}`,
    `Tempat tanggal lahir: ${[c.birthPlace, d(c.birthDate)].filter(Boolean).join(", ") || "-"}`,
    `Paket yg dipesan : ${c.packageName ?? "-"}`,
    `Hari/tgl kirim : ${d(c.deliveryDate) || "-"}`,
    `Jam kirim : ${c.deliverySlot ?? "-"}`,
    `Alamat kirim : ${c.address ?? "-"}`,
    `Catatan khusus : ${c.notes?.trim() || "-"}`,
    `Nomor HP : ${c.phone ?? "-"}`,
    `Sumber Informasi : ${c.source ?? "-"}`,
    "___",
    "",
    "Notes :",
    "1. Pembayaran bisa tunai atau transfer Bank :",
    "BSI 7211444748",
    "a.n CV. Priangan Agro Sentosa",
    "2. Bisa DP 50%",
    "3. Pelunasan saat pesanan dikirim",
    "4. Dengan ini kami mohon izin utk dokumentasi acara dan penggunaan utk media sosial & promosi.",
    `5. Konfirmasi dokumentasi: ${consent}.`,
  ];
  // buang baris kosong berlebih
  return lines.filter((l, i, all) => l.trim() !== "" || all[i - 1]?.trim() !== "").join("\n");
}

/** Kirim WA konfirmasi pemesanan ke nomor pelanggan (provider aktif: Fonnte / Cloud / WAHA). */
export async function sendCustomerConfirmation(id: string, actorId: string | null): Promise<string> {
  const c = await requireCustomer(id);
  const to = c.whatsapp?.trim() || c.phone?.trim() || "";
  if (!to) throw new AppError("VALIDATION_ERROR", "Pelanggan ini belum punya nomor WhatsApp/HP.");
  const message = buildCustomerConfirmationMessage(c);
  const result = await sendWhatsapp({ to, message, kind: "MANUAL", branchId: c.branchId, actorId });
  return result.phone;
}
