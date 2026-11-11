import {
  boolean,
  index,
  uniqueIndex,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps, users } from "./core";

export const auditAction = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "TRANSITION",
  "POST",
  "REVERSE",
  "APPROVE",
  "REJECT",
  "IMPORT",
  "EXPORT",
  "WEBHOOK",
  "OTHER",
]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRoleIds: jsonb("actor_role_ids"),
    action: auditAction("action").notNull(),
    module: varchar("module", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 64 }),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_actor_idx").on(t.actorUserId),
    index("audit_action_idx").on(t.action),
  ]
);

export const idempotencyStatus = pgEnum("idempotency_status", [
  "PENDING",
  "PROCESSED",
  "FAILED",
]);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    scope: varchar("scope", { length: 80 }).notNull(),
    requestHash: varchar("request_hash", { length: 128 }),
    payload: jsonb("payload"),
    status: idempotencyStatus("status").notNull().default("PENDING"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("idem_status_idx").on(t.status), index("idem_scope_idx").on(t.scope)]
);

export const webhookStatus = pgEnum("webhook_status", [
  "RECEIVED",
  "PROCESSED",
  "FAILED",
  "IGNORED",
]);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 40 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 160 }),
    payload: jsonb("payload").notNull(),
    signatureHash: varchar("signature_hash", { length: 128 }),
    status: webhookStatus("status").notNull().default("RECEIVED"),
    errors: jsonb("errors"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("webhook_provider_idx").on(t.provider, t.status),
    index("webhook_provider_event_uidx").on(t.provider, t.providerEventId),
  ]
);

export const notificationChannel = pgEnum("notification_channel", [
  "IN_APP",
  "WA",
  "EMAIL",
  "TELEGRAM",
  "PUSH",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    channel: notificationChannel("channel").notNull().default("IN_APP"),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body"),
    data: jsonb("data"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    providerStatus: jsonb("provider_status"),
    ...timestamps,
  },
  (t) => [index("notif_user_idx").on(t.userId), index("notif_read_idx").on(t.isRead)]
);
/** Broadcast read receipts belong to a user, never to the broadcast row. */
export const notificationReads = pgTable("notification_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("notification_reads_user_uidx").on(t.notificationId, t.userId)]);
