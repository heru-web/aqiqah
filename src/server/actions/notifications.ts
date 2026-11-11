"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/server/auth";
import { countUnread, markAllRead, markRead } from "@/server/services/notifications";

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireAuth();
  await markRead(id, user);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireAuth();
  await markAllRead(user);
  revalidatePath("/", "layout");
}

export async function notificationCountAction(): Promise<number> {
  const user = await requireAuth();
  return countUnread(user);
}
