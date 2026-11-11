"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { businessUnits, departments, positions, salesChannels } from "@/db/schema";
import { insertAudit } from "@/lib/server/audit";

type MasterTableKey = "businessUnits" | "departments" | "positions" | "salesChannels";

const PATHS: Record<MasterTableKey, string> = {
  businessUnits: "/data-induk/unit-usaha",
  departments: "/data-induk/departemen",
  positions: "/data-induk/jabatan",
  salesChannels: "/data-induk/saluran",
};

/** Menonaktifkan baris master data pilihan (idempotent, audit tercatat). */
export async function bulkSetInactiveAction(
  table: MasterTableKey,
  ids: string[]
): Promise<{ error?: string }> {
  const actor = await requirePermission("performance.master.update");
  if (ids.length === 0) return {};
  try {
    switch (table) {
      case "businessUnits":
        await db.update(businessUnits).set({ isActive: false }).where(inArray(businessUnits.id, ids));
        break;
      case "departments":
        await db.update(departments).set({ isActive: false }).where(inArray(departments.id, ids));
        break;
      case "positions":
        await db.update(positions).set({ isActive: false }).where(inArray(positions.id, ids));
        break;
      case "salesChannels":
        await db.update(salesChannels).set({ isActive: false }).where(inArray(salesChannels.id, ids));
        break;
      default:
        return { error: "Tabel tidak dikenal." };
    }
    await insertAudit(db, {
      actor,
      action: "UPDATE",
      module: table,
      entityType: table,
      entityId: ids[0],
      after: { bulkSetInactive: true, ids },
    });
    revalidatePath(PATHS[table]);
    return {};
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menonaktifkan data." };
  }
}

// Wrapper supaya diteruskan sebagai Server Action dari RSC (tidak boleh arrow inline).
export async function deactivateBusinessUnitsAction(ids: string[]) {
  return bulkSetInactiveAction("businessUnits", ids);
}
export async function deactivateDepartmentsAction(ids: string[]) {
  return bulkSetInactiveAction("departments", ids);
}
export async function deactivatePositionsAction(ids: string[]) {
  return bulkSetInactiveAction("positions", ids);
}
export async function deactivateSalesChannelsAction(ids: string[]) {
  return bulkSetInactiveAction("salesChannels", ids);
}
