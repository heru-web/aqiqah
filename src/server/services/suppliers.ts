import "server-only";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, suppliers } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export const SUPPLIER_TYPES = ["HEWAN", "BAHAN", "JASA", "LAIN"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export interface SupplierInput {
  name: string;
  type?: SupplierType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
}

function clean(value?: string | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function normalize(input: SupplierInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Nama supplier minimal 2 karakter.");
  const type = (input.type ?? "HEWAN") as SupplierType;
  if (!SUPPLIER_TYPES.includes(type)) throw new ValidationError("Tipe supplier tidak valid.");
  return {
    name,
    type,
    phone: clean(input.phone),
    email: clean(input.email),
    address: clean(input.address),
    city: clean(input.city),
    notes: clean(input.notes),
  };
}

export async function listSuppliers(opts: { q?: string; includeInactive?: boolean } = {}) {
  const q = opts.q?.trim();
  const rows = await db
    .select()
    .from(suppliers)
    .where(
      and(
        opts.includeInactive ? undefined : eq(suppliers.isActive, true),
        q
          ? or(
              ilike(suppliers.name, `%${q}%`),
              ilike(suppliers.phone, `%${q}%`),
              ilike(suppliers.city, `%${q}%`)
            )
          : undefined
      )
    )
    .orderBy(asc(suppliers.name));

  const counts = await db
    .select({ supplierId: animals.supplierId, n: sql<number>`count(*)::int` })
    .from(animals)
    .groupBy(animals.supplierId);
  const countMap = new Map(counts.map((c) => [c.supplierId, Number(c.n)]));

  return rows.map((s) => ({ ...s, animalCount: countMap.get(s.id) ?? 0 }));
}

export async function getSupplier(id: string) {
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return row ?? null;
}

export async function createSupplier(input: SupplierInput, actor: AuthUser): Promise<string> {
  const data = normalize(input);
  const [row] = await db.insert(suppliers).values(data).returning({ id: suppliers.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "inventory",
    entityType: "supplier",
    entityId: row.id,
    after: data,
  });
  return row.id;
}

export async function updateSupplier(id: string, input: SupplierInput, actor: AuthUser): Promise<void> {
  const before = await getSupplier(id);
  if (!before) throw new NotFoundError("Supplier tidak ditemukan.");
  const data = normalize(input);
  if (data.name !== before.name) {
    const dup = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.name, data.name), eq(suppliers.isActive, true)))
      .limit(1);
    if (dup.length > 0 && dup[0].id !== id) {
      throw new ConflictError(`Supplier "${data.name}" sudah ada.`);
    }
  }
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "inventory",
    entityType: "supplier",
    entityId: id,
    before,
    after: data,
  });
}

/** Hapus supplier (bulk). Supplier yang masih memegang hewan ditolak. */
export async function deleteSuppliers(ids: string[], actor: AuthUser): Promise<{ error?: string }> {
  const withAnimals = await db
    .select({ supplierId: animals.supplierId })
    .from(animals)
    .where(inArray(animals.supplierId, ids));
  const blocked = new Set(withAnimals.map((a) => a.supplierId).filter(Boolean));
  if (blocked.size > 0) {
    return { error: `Lepas/delete hewan yang terhubung dulu (${blocked.size} supplier masih terpakai).` };
  }
  const before = await db.select().from(suppliers).where(inArray(suppliers.id, ids));
  await db.delete(suppliers).where(inArray(suppliers.id, ids));
  for (const b of before) {
    await insertAudit(db, { actor, action: "DELETE", module: "inventory", entityType: "supplier", entityId: b.id, before: b });
  }
  return {};
}

export async function setSupplierActive(id: string, isActive: boolean, actor: AuthUser): Promise<void> {
  const before = await getSupplier(id);
  if (!before) throw new NotFoundError("Supplier tidak ditemukan.");
  await db.update(suppliers).set({ isActive }).where(eq(suppliers.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "inventory",
    entityType: "supplier",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive },
  });
}
