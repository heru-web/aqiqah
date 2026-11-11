import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("users_branch_idx").on(t.branchId)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)]
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("roles_slug_uidx").on(t.slug)]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 120 }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("role_permission_uidx").on(t.roleId, t.permission)]
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_role_uidx").on(t.userId, t.roleId)]
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 16 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    ownerName: varchar("owner_name", { length: 160 }),
    address: text("address"),
    city: varchar("city", { length: 80 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    igHandle: varchar("ig_handle", { length: 80 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("branches_code_uidx").on(t.code)]
);

export const appSettings = pgTable(
  "app_settings",
  {
    key: varchar("key", { length: 120 }).primaryKey(),
    value: jsonb("value"),
    ...timestamps,
  },
  (t) => [index("app_settings_ts_idx").on(t.createdAt)]
);

/** Metadata aplikasi: skema/migrasi, fitur, dll. */
export const appMeta = pgTable("app_meta", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Counter atomik untuk nomor dokumen (ORD-2026-0001 dst). */
export const counters = pgTable(
  "counters",
  {
    name: varchar("name", { length: 120 }).primaryKey(), // contoh "orders:2026"
    value: bigint("value", { mode: "bigint" }).notNull().default(sql`0`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("counters_updated_idx").on(t.updatedAt)]
);

export type CoreSchema = {
  users: typeof users.$inferSelect;
  sessions: typeof sessions.$inferSelect;
  roles: typeof roles.$inferSelect;
  rolePermissions: typeof rolePermissions.$inferSelect;
  userRoles: typeof userRoles.$inferSelect;
  branches: typeof branches.$inferSelect;
};