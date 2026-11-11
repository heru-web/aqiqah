"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseIDR } from "@/lib/money";
import { requirePermission } from "@/lib/server/auth";
import { saveAccountOpenings } from "@/server/services/openings";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveAccountOpeningsFormAction(fd: FormData): Promise<void> {
  const actor = await requirePermission("accounting.posting.update");
  const branchId = field(fd, "branchId");
  if (!branchId) return;

  const entries: Array<{ accountId: string; opening: bigint }> = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("opening_")) continue;
    const accountId = key.slice("opening_".length);
    if (!accountId) continue;
    const raw = typeof value === "string" ? value.trim() : "";
    entries.push({ accountId, opening: parseIDR(raw || "0") });
  }

  let saved = false;
  try {
    await saveAccountOpenings(branchId, entries, actor);
    saved = true;
  } catch {}
  revalidatePath("/reports");
  if (saved) redirect(`/reports?ob=${branchId}#saldo-awal`);
}
