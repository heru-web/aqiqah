"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIDR } from "@/lib/money";
import { requirePermission } from "@/lib/server/auth";
import {
  createAnimal,
  setAnimalStatus,
  updateAnimal,
  type AnimalSpecies,
  type AnimalStatus,
} from "@/server/services/animals";
import {
  createSupplier,
  setSupplierActive,
  updateSupplier,
  type SupplierType,
} from "@/server/services/suppliers";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

function optional(fd: FormData, key: string): string | undefined {
  const value = field(fd, key).trim();
  return value || undefined;
}

function supplierPayload(fd: FormData) {
  return {
    name: field(fd, "name"),
    type: (field(fd, "type") || "HEWAN") as SupplierType,
    phone: optional(fd, "phone"),
    email: optional(fd, "email"),
    address: optional(fd, "address"),
    city: optional(fd, "city"),
    notes: optional(fd, "notes"),
  };
}

export async function saveSupplierFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const actor = await requirePermission(
    id ? "inventory.procurement.update" : "inventory.procurement.create"
  );
  if (id) await assertResourceAccess("supplier", id, actor);
  let saved = false;
  try {
    const payload = supplierPayload(fd);
    if (id) await updateSupplier(id, payload, actor);
    else await createSupplier(payload, actor);
    saved = true;
  } catch {}
  if (!saved) return;
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function toggleSupplierActiveFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  if (!id) return;
  const actor = await requirePermission("inventory.procurement.update");
  await assertResourceAccess("supplier", field(fd, "id"), actor);
  try {
    await setSupplierActive(id, field(fd, "active") === "1", actor);
    revalidatePath("/suppliers");
  } catch {}
}

function animalPayload(fd: FormData) {
  const purchasedAtRaw = field(fd, "purchasedAt");
  return {
    branchId: optional(fd, "branchId") ?? null,
    supplierId: optional(fd, "supplierId") ?? null,
    species: (field(fd, "species") || "KAMBING") as AnimalSpecies,
    breed: optional(fd, "breed"),
    weightKg: optional(fd, "weightKg"),
    ageMonths: optional(fd, "ageMonths"),
    tagNumber: optional(fd, "tagNumber"),
    gender: optional(fd, "gender"),
    status: (field(fd, "status") || "AVAILABLE") as AnimalStatus,
    purchasePrice: parseIDR(field(fd, "purchasePrice") || "0"),
    skkhNumber: optional(fd, "skkhNumber"),
    purchasedAt: purchasedAtRaw ? new Date(`${purchasedAtRaw}T00:00:00`) : null,
    notes: optional(fd, "notes"),
  };
}

export async function saveAnimalFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const actor = await requirePermission(id ? "inventory.stock.update" : "inventory.stock.create");
  if (id) await assertResourceAccess("animal", id, actor);
  let saved = false;
  try {
    const payload = animalPayload(fd);
    if (!payload.branchId && actor.branchId) payload.branchId = actor.branchId;
    if (id) await updateAnimal(id, payload, actor);
    else await createAnimal(payload, actor);
    saved = true;
  } catch {}
  if (!saved) return;
  revalidatePath("/animals");
  redirect("/animals");
}

export async function setAnimalStatusFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const status = field(fd, "status") as AnimalStatus;
  if (!id || !status) return;
  const actor = await requirePermission("inventory.stock.update");
  await assertResourceAccess("animal", field(fd, "id"), actor);
  try {
    await setAnimalStatus(id, status, actor);
    revalidatePath("/animals");
  } catch {}
}
