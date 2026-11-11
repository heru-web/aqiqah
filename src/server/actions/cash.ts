"use server";

import { assertResourceAccess } from "@/lib/server/resource-access";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { createCashAccount, updateCashAccount } from "@/server/services/cash";

export type CashFormState = { error?: string; success?: boolean } | undefined;

function field(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : fallback;
}

export async function createCashAccountAction(_prev: CashFormState, fd: FormData): Promise<CashFormState> {
  const actor = await requirePermission("cash.cash.create");
  try {
    const name = field(fd, "name").trim();
    const type = field(fd, "type") as "BANK" | "CASH" | "EWALLET" | "VA";
    const bankName = field(fd, "bankName").trim() || null;
    const accountNumber = field(fd, "accountNumber").trim() || null;
    const openingBalanceStr = field(fd, "openingBalance").trim();
    const openingBalance = openingBalanceStr ? BigInt(openingBalanceStr) : 0n;
    if (!name || !type) return { error: "Nama dan tipe wajib diisi." };
    await createCashAccount({ name, type, bankName, accountNumber, openingBalance, isActive: true }, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal menambah akun kas/bank." };
  }
  revalidatePath("/cash");
  return { success: true };
}

export async function updateCashAccountAction(id: string, _prev: CashFormState, fd: FormData): Promise<CashFormState> {
  const actor = await requirePermission("cash.cash.update");
  await assertResourceAccess("cash", id, actor);
  try {
    const name = field(fd, "name").trim();
    const bankName = field(fd, "bankName").trim() || null;
    const accountNumber = field(fd, "accountNumber").trim() || null;
    if (!name) return { error: "Nama wajib diisi." };
    await updateCashAccount(id, { name, bankName, accountNumber }, actor);
  } catch (err) {
    return { error: AppError.is(err) ? err.message : "Gagal mengubah akun kas/bank." };
  }
  revalidatePath("/cash");
  return { success: true };
}
