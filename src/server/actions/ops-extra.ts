"use server";
import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/server/auth";
import { closePeriod, reopenPeriod, setKitchenTaskStatus } from "@/server/services/periods";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

export async function closePeriodFormAction(fd: FormData): Promise<void> {
  const actor = await requirePermission("accounting.posting.create");
  try {
    await closePeriod(field(fd, "period").trim(), field(fd, "note"), actor);
    revalidatePath("/reports");
  } catch {}
}

export async function reopenPeriodFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  if (!id) return;
  const actor = await requirePermission("accounting.posting.update");
  try {
    await reopenPeriod(id, field(fd, "reason"), actor);
    revalidatePath("/reports");
  } catch {}
}

export async function setKitchenTaskStatusFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const status = (field(fd, "status") || "SIAP") as "MENUNGGU" | "SIAP";
  if (!id) return;
  const actor = await requirePermission("production.batches.update");
  await assertResourceAccess("kitchen", id, actor);
  try {
    await setKitchenTaskStatus(id, status, actor);
    revalidatePath("/production");
  } catch {}
}
