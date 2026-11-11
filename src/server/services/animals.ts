import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { animals, branches, suppliers } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";

export const ANIMAL_SPECIES = ["KAMBING", "SAPI"] as const;
export const ANIMAL_STATUSES = ["AVAILABLE", "RESERVED", "SLAUGHTERED", "ISSUED", "LOSS"] as const;
export type AnimalSpecies = (typeof ANIMAL_SPECIES)[number];
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

export interface AnimalInput {
  branchId?: string | null;
  supplierId?: string | null;
  species: AnimalSpecies;
  breed?: string | null;
  weightKg?: string | null;
  ageMonths?: string | null;
  tagNumber?: string | null;
  gender?: string | null;
  status?: AnimalStatus;
  purchasePrice?: bigint;
  pen?: string | null;
  skkhNumber?: string | null;
  skkhFileUrl?: string | null;
  purchasedAt?: Date | null;
  notes?: string | null;
}

export interface AnimalListFilter {
  branchId?: string | null;
  status?: string;
  species?: string;
  supplierId?: string;
  q?: string;
}

function clean(value?: string | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function isSpecies(value: unknown): value is AnimalSpecies {
  return typeof value === "string" && (ANIMAL_SPECIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is AnimalStatus {
  return typeof value === "string" && (ANIMAL_STATUSES as readonly string[]).includes(value);
}

function normalize(input: AnimalInput) {
  if (!isSpecies(input.species)) throw new ValidationError("Spesies hewan harus KAMBING atau SAPI.");
  const status = input.status ?? "AVAILABLE";
  if (!isStatus(status)) throw new ValidationError("Status hewan tidak valid.");
  const purchasePrice = input.purchasePrice ?? 0n;
  if (purchasePrice < 0n) throw new ValidationError("Harga beli tidak boleh negatif.");
  return {
    branchId: input.branchId || null,
    supplierId: input.supplierId || null,
    species: input.species,
    breed: clean(input.breed),
    weightKg: clean(input.weightKg),
    ageMonths: clean(input.ageMonths),
    tagNumber: clean(input.tagNumber),
    gender: clean(input.gender),
    status,
    purchasePrice,
    pen: clean(input.pen),
    skkhNumber: clean(input.skkhNumber),
    skkhFileUrl: clean(input.skkhFileUrl),
    purchasedAt: input.purchasedAt ?? null,
    notes: clean(input.notes),
  };
}

export async function listAnimals(filter: AnimalListFilter = {}) {
  const q = filter.q?.trim();
  const rows = await db
    .select({
      animal: animals,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
      branchName: branches.name,
    })
    .from(animals)
    .leftJoin(suppliers, eq(animals.supplierId, suppliers.id))
    .leftJoin(branches, eq(animals.branchId, branches.id))
    .where(
      and(
        filter.branchId ? eq(animals.branchId, filter.branchId) : undefined,
        isStatus(filter.status) ? eq(animals.status, filter.status) : undefined,
        isSpecies(filter.species) ? eq(animals.species, filter.species) : undefined,
        filter.supplierId ? eq(animals.supplierId, filter.supplierId) : undefined,
        q
          ? or(
              ilike(animals.tagNumber, `%${q}%`),
              ilike(animals.breed, `%${q}%`),
              ilike(animals.pen, `%${q}%`),
              ilike(suppliers.name, `%${q}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(animals.createdAt));

  return rows.map((r) => ({
    ...r.animal,
    supplierName: r.supplierName,
    supplierPhone: r.supplierPhone,
    branchName: r.branchName,
  }));
}

export async function getAnimal(id: string) {
  const [row] = await db.select().from(animals).where(eq(animals.id, id)).limit(1);
  return row ?? null;
}

export async function animalSummary(branchId?: string | null) {
  const rows = await db
    .select({
      species: animals.species,
      status: animals.status,
      n: sql<number>`count(*)::int`,
    })
    .from(animals)
    .where(branchId ? eq(animals.branchId, branchId) : undefined)
    .groupBy(animals.species, animals.status);

  let total = 0;
  let available = 0;
  let reserved = 0;
  let kambing = 0;
  let sapi = 0;
  for (const row of rows) {
    const n = Number(row.n);
    total += n;
    if (row.status === "AVAILABLE") available += n;
    if (row.status === "RESERVED") reserved += n;
    if (row.species === "KAMBING") kambing += n;
    else sapi += n;
  }
  return { total, available, reserved, kambing, sapi };
}



/** Hapus herd (bulk). Hewan yang sudah dipakai order ditolak. */
export async function deleteAnimals(ids: string[], actor: AuthUser): Promise<{ error?: string }> {
  const rows = await db.select().from(animals).where(inArray(animals.id, ids));
  const used = rows.filter((r) => r.orderId);
  if (used.length > 0) {
    return { error: `${used.length} hewan sudah dipakai order — tidak dapat dihapus.` };
  }
  for (const r of rows) {
    await db.delete(animals).where(eq(animals.id, r.id));
    await insertAudit(db, { actor, action: "DELETE", module: "inventory", entityType: "animal", entityId: r.id, before: r });
  }
  return {};
}

export async function createAnimal(input: AnimalInput, actor: AuthUser): Promise<string> {
  const data = normalize(input);
  const [row] = await db.insert(animals).values(data).returning({ id: animals.id });
  await insertAudit(db, {
    actor,
    action: "CREATE",
    module: "inventory",
    entityType: "animal",
    entityId: row.id,
    after: { ...data, purchasePrice: data.purchasePrice.toString() },
  });
  return row.id;
}

export async function updateAnimal(id: string, input: AnimalInput, actor: AuthUser): Promise<void> {
  const before = await getAnimal(id);
  if (!before) throw new NotFoundError("Hewan tidak ditemukan.");
  const data = normalize(input);
  await db.update(animals).set(data).where(eq(animals.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "inventory",
    entityType: "animal",
    entityId: id,
    before: { ...before, purchasePrice: before.purchasePrice.toString() },
    after: { ...data, purchasePrice: data.purchasePrice.toString() },
  });
}

export async function setAnimalStatus(id: string, status: AnimalStatus, actor: AuthUser): Promise<void> {
  if (!isStatus(status)) throw new ValidationError("Status hewan tidak valid.");
  const before = await getAnimal(id);
  if (!before) throw new NotFoundError("Hewan tidak ditemukan.");
  await db.update(animals).set({ status }).where(eq(animals.id, id));
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "inventory",
    entityType: "animal",
    entityId: id,
    before: { status: before.status },
    after: { status },
  });
}
