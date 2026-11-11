import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationReads, notifications } from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";

export interface InboxNotification {
  id: string; title: string; body: string | null; isRead: boolean; createdAt: string;
  data: Record<string, unknown> | null;
}

function inboxFilter(user: AuthUser) {
  return and(eq(notifications.channel, "IN_APP"),
    or(eq(notifications.userId, user.id), and(isNull(notifications.userId),
      or(isNull(notifications.branchId), user.branchId ? eq(notifications.branchId, user.branchId) : sql`false`))));
}

const readValue = sql<boolean>`(${notificationReads.id} is not null or (${notifications.userId} is not null and ${notifications.isRead}))`;

function receiptJoin(user: AuthUser) {
  return and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, user.id));
}

export async function listInbox(user: AuthUser, limit = 12): Promise<InboxNotification[]> {
  const rows = await db.select({ id: notifications.id, title: notifications.title, body: notifications.body,
    isRead: readValue, createdAt: notifications.createdAt, data: notifications.data })
    .from(notifications).leftJoin(notificationReads, receiptJoin(user)).where(inboxFilter(user))
    .orderBy(desc(notifications.createdAt)).limit(limit);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(),
    data: (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Record<string, unknown> | null }));
}

export async function countUnread(user: AuthUser): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(notifications)
    .leftJoin(notificationReads, receiptJoin(user)).where(and(inboxFilter(user), sql`not ${readValue}`));
  return row?.total ?? 0;
}

export async function markRead(id: string, user: AuthUser): Promise<void> {
  const [row] = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.id, id), inboxFilter(user))).limit(1);
  if (row) await db.insert(notificationReads).values({ notificationId: row.id, userId: user.id }).onConflictDoNothing();
}

export async function markAllRead(user: AuthUser): Promise<void> {
  const rows = await db.select({ id: notifications.id }).from(notifications).where(inboxFilter(user));
  if (rows.length) await db.insert(notificationReads).values(rows.map((row) => ({ notificationId: row.id, userId: user.id }))).onConflictDoNothing();
}
