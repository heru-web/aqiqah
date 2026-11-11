import {
  bigint,
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";
import { businessUnits, salesChannels } from "./performance";

export const customerType = pgEnum("customer_type", ["PERUSAHAAN", "PERORANGAN"]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    code: varchar("code", { length: 24 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: customerType("type").notNull().default("PERORANGAN"),
    phone: varchar("phone", { length: 32 }),
    whatsapp: varchar("whatsapp", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 80 }),
    province: varchar("province", { length: 80 }),
    npwp: varchar("npwp", { length: 24 }),
    source: varchar("source", { length: 40 }),
    salesLeadId: uuid("sales_lead_id"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // Aqiqah intake (form "Alhamdulillah Barakallah")
    ayahName: varchar("ayahName", { length: 160 }),
    ibuName: varchar("ibuName", { length: 160 }),
    birthPlace: varchar("birthPlace", { length: 120 }),
    birthDate: date("birthDate"),
    packageName: varchar("packageName", { length: 160 }),
    deliveryDate: timestamp("deliveryDate", { withTimezone: true }),
    deliverySlot: varchar("deliverySlot", { length: 40 }),
    consent: text("consent"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("customers_branch_idx").on(t.branchId),
    index("customers_name_idx").on(t.name),
    index("customers_phone_idx").on(t.phone),
  ]
);

export const communicationDirection = pgEnum("communication_direction", ["IN", "OUT"]);

export const customerCommunications = pgTable(
  "customer_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // WA | CALL | EMAIL | MEETING
    direction: communicationDirection("direction").notNull(),
    channelRef: varchar("channel_ref", { length: 160 }),
    summary: text("summary"),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("comm_customer_idx").on(t.customerId)]
);

export const leadSource = pgEnum("lead_source", [
  "REFERRAL",
  "ADS",
  "SOCIAL",
  "MARKETPLACE",
  "WALK_IN",
  "WEB",
  "AFILIATE",
  "AGEN",
  "WA_BLAST",
  "OTHER",
]);

export const leadStatus = pgEnum("lead_status", [
  "LEAD",
  "CONTACTED",
  "INTERESTED",
  "QUOTATION",
  "DP",
  "CLOSED",
]);

/** 6 state internal PRD; label UI tampil sesuai Stitch (Lead Baru dsb). */
export const leadStatusOrder: Record<LeadStatus, number> = {
  LEAD: 0,
  CONTACTED: 1,
  INTERESTED: 2,
  QUOTATION: 3,
  DP: 4,
  CLOSED: 5,
};

export type LeadStatus = (typeof leadStatus.enumValues)[number];

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    source: leadSource("source").notNull().default("WALK_IN"),
    status: leadStatus("status").notNull().default("LEAD"),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => salesChannels.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    whatsapp: varchar("whatsapp", { length: 32 }),
    email: varchar("email", { length: 255 }),
    company: varchar("company", { length: 200 }),
    city: varchar("city", { length: 80 }),
    address: varchar("address", { length: 255 }),
    productInterest: varchar("product_interest", { length: 80 }), // kambing | sapi | pesanan_olah | paket
    budget: bigint("budget", { mode: "bigint" }),
    notes: text("notes"),
    isWhatsappConnected: boolean("is_whatsapp_connected").notNull().default(false),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("leads_branch_status_idx").on(t.branchId, t.status),
    index("leads_assigned_idx").on(t.assignedTo),
    index("leads_next_followup_idx").on(t.nextFollowupAt),
  ]
);

export const followupMethod = pgEnum("followup_method", ["WA", "CALL", "MEETING", "EMAIL"]);

export const leadFollowups = pgTable(
  "lead_followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => users.id, { onDelete: "set null" }),
    method: followupMethod("method").notNull(),
    summary: text("summary"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("PLANNED"), // PLANNED|DONE|MISSED|CANCELLED
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("followup_lead_idx").on(t.leadId)]
);