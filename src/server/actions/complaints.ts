"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createComplaint, setComplaintStatus, type ComplaintSeverity, type ComplaintStatus } from "@/server/services/complaints";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

function optional(fd: FormData, key: string): string | undefined {
  const value = field(fd, key).trim();
  return value || undefined;
}

export async function createComplaintFormAction(fd: FormData): Promise<void> {
  const actor = await requirePermission("crm.followups.create");
  let saved = false;
  try {
    await createComplaint(
      {
        branchId: optional(fd, "branchId") ?? null,
        customerId: optional(fd, "customerId") ?? null,
        channel: optional(fd, "channel"),
        category: optional(fd, "category"),
        severity: (field(fd, "severity") || "SEDANG") as ComplaintSeverity,
        description: field(fd, "description"),
      },
      actor
    );
    saved = true;
  } catch {}
  revalidatePath("/complaints");
  if (saved) redirect("/complaints");
}

export async function setComplaintStatusFormAction(fd: FormData): Promise<void> {
  const id = field(fd, "id");
  const status = field(fd, "status") as ComplaintStatus;
  if (!id || !status) return;
  const actor = await requirePermission("crm.followups.update");
  try {
    await setComplaintStatus(id, status, field(fd, "resolution"), actor);
    revalidatePath("/complaints");
  } catch {}
}
