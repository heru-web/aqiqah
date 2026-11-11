"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIDR } from "@/lib/money";
import { requirePermission } from "@/lib/server/auth";
import { createVoucher, setVoucherActive, updateVoucher, type VoucherType } from "@/server/services/vouchers";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

function dateOrNull(value: string): Date | null {
  const v = value.trim();
  return v ? new Date(`${v}T00:00:00`) : null;
}

function voucherPayload(fd: FormData) {
  const type = (field(fd, "type") || "NOMINAL") as VoucherType;
  return {
    code: field(fd, "code"),
    type,
    nominalAmount: parseIDR(field(fd, "nominalAmount") || "0"),
    percentBps: Math.round(Number(field(fd, "percentBps") || "0") * 100),
    maxUsage: field(fd, "maxUsage") ? Number(field(fd, "maxUsage")) : null,
    startsAt: dateOrNull(field(fd, "startsAt")),
    expiresAt: dateOrNull(field(fd, "expiresAt")),
    isActive: field(fd, "isActive") === "1",
  };
}

export async function saveVoucherFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const actor = await requirePermission(id ? "products.pricing.update" : "products.pricing.create");
  let saved = false;
  try {
    const payload = voucherPayload(fd);
    if (id) await updateVoucher(id, payload, actor);
    else await createVoucher(payload, actor);
    saved = true;
  } catch {}
  if (!saved) return;
  revalidatePath("/vouchers");
  redirect("/vouchers");
}

export async function toggleVoucherActiveFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  if (!id) return;
  const actor = await requirePermission("products.pricing.update");
  try {
    await setVoucherActive(id, field(fd, "active") === "1", actor);
    revalidatePath("/vouchers");
  } catch {}
}
