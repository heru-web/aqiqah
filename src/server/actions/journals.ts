"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requirePermission } from "@/lib/server/auth";
import { reverseJournal } from "@/server/services/journal";

export async function reverseJournalFormAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const actor = await requirePermission("accounting.posting.update");
  try {
    await reverseJournal(db, id, actor, String(fd.get("reason") ?? "").trim());
    revalidatePath("/accounting");
  } catch {}
}
