"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/server/auth";
import { seedDemoData, clearDemoData } from "@/server/services/demo";

const DEMO_PATHS = [
  "/settings",
  "/karyawan",
  "/inventory",
  "/production",
  "/delivery",
  "/payroll",
  "/kasbon",
  "/ziswaf",
  "/quotations",
  "/orders",
  "/invoices",
  "/payments",
  "/cash",
  "/accounting",
  "/reports",
  "/crm",
  "/crm/contacts",
  "/crm/activities",
  "/attendance",
  "/data-induk/unit-usaha",
  "/data-induk/departemen",
  "/data-induk/jabatan",
  "/data-induk/saluran",
  "/customers",
];

export type DemoResult = { ok?: boolean; error?: string; message?: string };

export async function seedDemoAction(): Promise<DemoResult> {
  await requirePermission("settings.settings.update");
  try {
    const res = await seedDemoData();
    for (const p of DEMO_PATHS) revalidatePath(p);
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membuat data demo." };
  }
}

export async function clearDemoAction(): Promise<DemoResult> {
  await requirePermission("settings.settings.update");
  try {
    const res = await clearDemoData();
    for (const p of DEMO_PATHS) revalidatePath(p);
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus data demo." };
  }
}
