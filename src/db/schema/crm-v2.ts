import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";

/**
 * Modul CRM baru (adaptasi model Pipelite: pipeline, deals, people, organizations,
 * activities, notes). Tabel diberi prefiks `crm_` agar tidak bertabrakan dengan
 * skema CRM lama (`leads`, `lead_followups`, `customers`) yang tetap disimpan
 * sebagai sumber migrasi.
 */
export const crmStageType = pgEnum("crm_stage_type", ["OPEN", "WON", "LOST"]);

export const crmActivityType = pgEnum("crm_activity_type", [
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "TASK",
]);

export const crmPipelines = pgTable(
  "crm_pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: varchar("name", { length: 120 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("crm_pipelines_branch_idx").on(t.branchId)]
);

export const crmStages = pgTable(
  "crm_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 20 }).notNull().default("slate"),
    type: crmStageType("type").notNull().default("OPEN"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("crm_stages_pipeline_idx").on(t.pipelineId, t.position)]
);

export const crmOrganizations = pgTable(
  "crm_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    industry: varchar("industry", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 80 }),
    address: text("address"),
    notes: text("notes"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    legacyCustomerId: uuid("legacy_customer_id"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("crm_organizations_branch_idx").on(t.branchId),
    index("crm_organizations_name_idx").on(t.name),
    uniqueIndex("crm_organizations_legacy_uidx").on(t.legacyCustomerId),
  ]
);

export const crmPeople = pgTable(
  "crm_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => crmOrganizations.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    whatsapp: varchar("whatsapp", { length: 32 }),
    email: varchar("email", { length: 255 }),
    jobTitle: varchar("job_title", { length: 120 }),
    city: varchar("city", { length: 80 }),
    notes: text("notes"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    legacyCustomerId: uuid("legacy_customer_id"),
    legacyLeadId: uuid("legacy_lead_id"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("crm_people_branch_idx").on(t.branchId),
    index("crm_people_org_idx").on(t.organizationId),
    index("crm_people_name_idx").on(t.name),
    uniqueIndex("crm_people_legacy_customer_uidx").on(t.legacyCustomerId),
    uniqueIndex("crm_people_legacy_lead_uidx").on(t.legacyLeadId),
  ]
);

export const crmDeals = pgTable(
  "crm_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => crmStages.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    value: bigint("value", { mode: "bigint" }).notNull(),
    source: varchar("source", { length: 40 }),
    productInterest: varchar("product_interest", { length: 80 }),
    personId: uuid("person_id").references(() => crmPeople.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => crmOrganizations.id, {
      onDelete: "set null",
    }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    legacyLeadId: uuid("legacy_lead_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("crm_deals_branch_idx").on(t.branchId),
    index("crm_deals_stage_idx").on(t.stageId),
    index("crm_deals_owner_idx").on(t.ownerId),
    index("crm_deals_person_idx").on(t.personId),
    index("crm_deals_org_idx").on(t.organizationId),
    uniqueIndex("crm_deals_legacy_uidx").on(t.legacyLeadId),
  ]
);

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => crmDeals.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => crmPeople.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => crmOrganizations.id, {
      onDelete: "cascade",
    }),
    type: crmActivityType("type").notNull().default("TASK"),
    title: varchar("title", { length: 200 }).notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    legacyFollowupId: uuid("legacy_followup_id"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("crm_activities_branch_idx").on(t.branchId),
    index("crm_activities_deal_idx").on(t.dealId),
    index("crm_activities_person_idx").on(t.personId),
    index("crm_activities_due_idx").on(t.dueAt),
    uniqueIndex("crm_activities_legacy_uidx").on(t.legacyFollowupId),
  ]
);

export const crmNotes = pgTable(
  "crm_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => crmDeals.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => crmPeople.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => crmOrganizations.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("crm_notes_deal_idx").on(t.dealId),
    index("crm_notes_person_idx").on(t.personId),
    index("crm_notes_org_idx").on(t.organizationId),
  ]
);

export const crmStageHistory = pgTable(
  "crm_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => crmDeals.id, { onDelete: "cascade" }),
    fromStageId: uuid("from_stage_id").references(() => crmStages.id, { onDelete: "set null" }),
    toStageId: uuid("to_stage_id").references(() => crmStages.id, { onDelete: "set null" }),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("crm_stage_history_deal_idx").on(t.dealId)]
);
