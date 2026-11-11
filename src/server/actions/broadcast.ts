"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { sendWhatsapp } from "@/server/services/whatsapp";
import { requirePermission } from "@/lib/server/auth";

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

/** Broadcast WA — kirim berkala ke kontak pelanggan cabang user; {nama} diganti nama kontak. */
export async function sendBroadcastFormAction(fd: FormData): Promise<void> {
  const actor = await requirePermission("notifications.notifications.update");
  const messageTemplate = field(fd, "message").trim();
  const confirm = field(fd, "confirm").trim().toUpperCase();
  const branchId = actor.branchId ?? null;

  if (!messageTemplate || confirm !== "KIRIM") return;

  const rows = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(and(isNull(customers.deletedAt), branchId ? eq(customers.branchId, branchId) : undefined))
    .limit(500);

  const seen = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (const c of rows) {
    const phone = (c.phone ?? "").trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const message = messageTemplate.replaceAll("{nama}", c.name);
    try {
      await sendWhatsapp({ to: phone, message, kind: "BROADCAST", actorId: actor.id, branchId, personId: c.id });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  redirect(`/broadcast?sent=${sent}&failed=${failed}`);
}
