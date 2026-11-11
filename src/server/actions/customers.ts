"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import type { AuthUser } from "@/lib/server/auth";
import {
  archiveCustomer,
  bulkArchiveCustomers,
  sendCustomerConfirmation,
  createCustomer,
  updateCustomer,
} from "@/server/services/customers";

export type CustomerFormState = { error?: string; success?: boolean } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : fallback;
}

export async function createCustomerAction(_prev: CustomerFormState, fd: FormData): Promise<CustomerFormState> {
  const actor = await requirePermission("customers.customers.create");
  try {
    await createCustomer(
      {
        name: field(fd, "name"),
        type: (field(fd, "type") || "PERORANGAN") as "PERUSAHAAN" | "PERORANGAN",
        phone: field(fd, "phone") || undefined,
        whatsapp: field(fd, "whatsapp") || undefined,
        email: field(fd, "email") || undefined,
        address: field(fd, "address") || undefined,
        city: field(fd, "city") || undefined,
        province: field(fd, "province") || undefined,
        npwp: field(fd, "npwp") || undefined,
        source: field(fd, "source") || undefined,
        notes: field(fd, "notes") || undefined,
        ayahName: field(fd, "ayahName") || undefined,
        ibuName: field(fd, "ibuName") || undefined,
        birthPlace: field(fd, "birthPlace") || undefined,
        birthDate: field(fd, "birthDate") || undefined,
        packageName: field(fd, "packageName") || undefined,
        deliveryDate: field(fd, "deliveryDate") || undefined,
        deliverySlot: field(fd, "deliverySlot") || undefined,
        consent: field(fd, "consent") || undefined,
      },
      actor
    );
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menyimpan pelanggan." };
  }
  revalidatePath("/customers");
  return { success: true };
}

export async function updateCustomerAction(_prev: CustomerFormState, fd: FormData): Promise<CustomerFormState> {
  const actor = await requirePermission("customers.customers.update");
  await assertResourceAccess("customer", String(fd.get("id") ?? ""), actor);
  const id = field(fd, "id");
  if (!id) return { error: "ID pelanggan tidak valid." };
  try {
    await updateCustomer(id, {
      name: field(fd, "name") || undefined,
      type: (field(fd, "type") || "PERORANGAN") as "PERUSAHAAN" | "PERORANGAN",
      phone: field(fd, "phone") || undefined,
      whatsapp: field(fd, "whatsapp") || undefined,
      email: field(fd, "email") || undefined,
      address: field(fd, "address") || undefined,
      city: field(fd, "city") || undefined,
      province: field(fd, "province") || undefined,
      npwp: field(fd, "npwp") || undefined,
      source: field(fd, "source") || undefined,
      notes: field(fd, "notes") || undefined,
      ayahName: field(fd, "ayahName") || undefined,
      ibuName: field(fd, "ibuName") || undefined,
      birthPlace: field(fd, "birthPlace") || undefined,
      birthDate: field(fd, "birthDate") || undefined,
      packageName: field(fd, "packageName") || undefined,
      deliveryDate: field(fd, "deliveryDate") || undefined,
      deliverySlot: field(fd, "deliverySlot") || undefined,
      consent: field(fd, "consent") || undefined,
    }, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal memperbarui pelanggan." };
  }
  revalidatePath("/customers");
  return { success: true };
}

export async function archiveCustomerAction(id: string): Promise<{ error?: string }> {
  const actor = await requirePermission("customers.customers.delete");
  await assertResourceAccess("customer", id, actor);
  try {
    await archiveCustomer(id, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengarsipkan." };
  }
  revalidatePath("/customers");
  return {};
}

export async function bulkArchiveCustomersAction(ids: string[]): Promise<{ error?: string }> {
  const actor = await requirePermission("customers.customers.delete");
  for (const id of ids) await assertResourceAccess("customer", id, actor);
  try {
    await bulkArchiveCustomers(ids, actor);
    revalidatePath("/customers");
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menghapus masal." };
  }
}

export async function sendCustomerConfirmationAction(id: string): Promise<{ error?: string; phone?: string }> {
  const actor = await requirePermission("customers.communications.action");
  await assertResourceAccess("customer", id, actor);
  try {
    const phone = await sendCustomerConfirmation(id, actor.id);
    return { phone };
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengirim WA konfirmasi." };
  }
}
