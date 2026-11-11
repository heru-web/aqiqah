"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { parseIDR } from "@/lib/money";
import { requirePermission } from "@/lib/server/auth";
import { deleteSuppliers } from "@/server/services/suppliers";
import { deleteAnimals } from "@/server/services/animals";
import { deleteComplaints } from "@/server/services/complaints";
import { deleteVouchers } from "@/server/services/vouchers";
import { deleteDeliveryTasks } from "@/server/services/route";
import { deleteInventoryItems, deleteKitchenTasks, deleteZiswafEntries, updateInventoryItem, updateZiswafEntry } from "@/server/services/erp";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

export async function deleteSuppliersAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.procurement.delete");
  for (const id of ids) await assertResourceAccess("supplier", id, actor);
  const res = await deleteSuppliers(ids, actor);
  revalidatePath("/suppliers");
  return res;
}

export async function deleteAnimalsAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.stock.delete");
  for (const id of ids) await assertResourceAccess("animal", id, actor);
  const res = await deleteAnimals(ids, actor);
  revalidatePath("/animals");
  return res;
}

export async function deleteComplaintsAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("crm.followups.delete");
  for (const id of ids) await assertResourceAccess("complaint", id, actor);
  const res = await deleteComplaints(ids, actor);
  revalidatePath("/complaints");
  return res;
}

export async function deleteVouchersAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("products.pricing.delete");
  const res = await deleteVouchers(ids, actor);
  revalidatePath("/vouchers");
  return res;
}

export async function deleteDeliveryTasksAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("delivery.deliveries.delete");
  for (const id of ids) await assertResourceAccess("delivery", id, actor);
  const res = await deleteDeliveryTasks(ids, actor);
  revalidatePath("/delivery");
  return res;
}

export async function deleteKitchenTasksAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("production.batches.delete");
  for (const id of ids) await assertResourceAccess("kitchen", id, actor);
  const res = await deleteKitchenTasks(ids, actor.id, actor.branchId);
  revalidatePath("/production");
  return res;
}

export async function deleteZiswafAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("ziswaf.ziswaf.delete");
  for (const id of ids) await assertResourceAccess("ziswaf", id, actor);
  const res = await deleteZiswafEntries(ids, actor.id, actor.branchId);
  revalidatePath("/ziswaf");
  return res;
}

export async function deleteInventoryItemsAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("inventory.stock.delete");
  for (const id of ids) await assertResourceAccess("inventory", id, actor);
  try {
    await deleteInventoryItems(ids);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus item." };
  }
  revalidatePath("/inventory");
  return {};
}

export async function updateInventoryItemFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("inventory.stock.update");
  await assertResourceAccess("inventory", field(fd, "itemId"), actor);
  const id = field(fd, "itemId");
  if (!id) return;
  try {
    await updateInventoryItem(id, {
      name: field(fd, "name") || undefined,
      category: field(fd, "category") || undefined,
      unit: field(fd, "unit") || undefined,
      minQty: field(fd, "minQty") ? Number(field(fd, "minQty")) : undefined,
      location: field(fd, "location") || undefined,
      notes: field(fd, "notes") || undefined,
    });
  } catch { return { error: "Perubahan gagal disimpan. Periksa data dan coba lagi." }; }
  revalidatePath("/inventory");
}

export async function updateZiswafFormAction(fd: FormData): Promise<{ error?: string } | void> {
  const actor = await requirePermission("ziswaf.ziswaf.update");
  await assertResourceAccess("ziswaf", field(fd, "id"), actor);
  const id = field(fd, "id");
  if (!id) return;
  try {
    await updateZiswafEntry(id, {
      amount: parseIDR(field(fd, "amount") || "0"),
      party: field(fd, "party").trim() || undefined,
      note: field(fd, "note").trim() || undefined,
    }, actor.id, actor.branchId);
  } catch { return { error: "Perubahan gagal disimpan. Periksa data dan coba lagi." }; }
  revalidatePath("/ziswaf");
}
