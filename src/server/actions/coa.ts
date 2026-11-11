"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { createAccount, toggleAccount, updateAccount } from "@/server/services/coa";

export type CoaFormState = { error?: string; success?: boolean } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : fallback;
}

function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export async function createAccountAction(_prev: CoaFormState, fd: FormData): Promise<CoaFormState> {
  const actor = await requirePermission("coa.coa.create");
  try {
    const code = field(fd, "code").trim();
    const name = field(fd, "name").trim();
    const type = field(fd, "type") as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
    const group = field(fd, "group").trim() || null;
    const description = field(fd, "description").trim() || null;
    const parentId = field(fd, "parentId").trim() || null;
    const isPostable = bool(fd, "isPostable");
    const openingBalanceStr = field(fd, "openingBalance").trim();
    const openingBalance = openingBalanceStr ? BigInt(openingBalanceStr) : 0n;
    if (!code || !name || !type) {
      return { error: "Kode, nama, dan tipe wajib diisi." };
    }
    await createAccount(
      {
        code,
        name,
        type,
        group,
        description,
        parentId,
        isPostable,
        isActive: true,
        isSystem: false,
        openingBalance,
      },
      actor
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menambah akun." };
  }
  revalidatePath("/coa");
  return { success: true };
}

export async function updateAccountAction(id: string, _prev: CoaFormState, fd: FormData): Promise<CoaFormState> {
  const actor = await requirePermission("coa.coa.update");
  try {
    const name = field(fd, "name").trim();
    const group = field(fd, "group").trim() || null;
    const description = field(fd, "description").trim() || null;
    const parentId = field(fd, "parentId").trim() || null;
    const isPostable = bool(fd, "isPostable");
    if (!name) {
      return { error: "Nama wajib diisi." };
    }
    await updateAccount(id, { name, group, description, parentId, isPostable }, actor);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah akun." };
  }
  revalidatePath("/coa");
  return { success: true };
}

export async function toggleAccountAction(id: string, isActive: boolean): Promise<void> {
  const actor = await requirePermission("coa.coa.update");
  await toggleAccount(id, isActive, actor);
  revalidatePath("/coa");
}
