import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";

// ── Enums ──────────────────────────────────────────────────────────
export const kpiScope = pgEnum("kpi_scope", [
  "COMPANY",
  "BUSINESS_UNIT",
  "CHANNEL",
  "DEPARTMENT",
  "POSITION",
]);
export const kpiUnit = pgEnum("kpi_unit", [
  "CURRENCY",
  "COUNT",
  "PERCENT",
  "RATIO",
  "DURATION",
  "SCORE",
]);
export const kpiDirection = pgEnum("kpi_direction", ["HIGHER_BETTER", "LOWER_BETTER"]);
export const kpiFrequency = pgEnum("kpi_frequency", ["DAILY", "WEEKLY", "MONTHLY"]);
export const periodType = pgEnum("period_type", ["DAILY", "WEEKLY", "MONTHLY"]);
export const actualSource = pgEnum("actual_source", ["AUTO", "MANUAL", "IMPORT"]);
export const actualStatus = pgEnum("actual_status", ["DRAFT", "SUBMITTED", "VERIFIED"]);
export const channelType = pgEnum("channel_type", ["ONLINE", "OFFLINE"]);
export const employeeStatus = pgEnum("employee_status", ["AKTIF", "CUTI", "RESIGN"]);
export const reviewSection = pgEnum("review_section", [
  "COMPANY",
  "BUSINESS_UNIT",
  "CHANNEL",
  "DEPARTMENT",
  "INDIVIDUAL",
]);
export const monthlyReviewStatus = pgEnum("monthly_review_status", ["DRAFT", "REVIEW", "APPROVED"]);
export const weeklyReviewStatus = pgEnum("weekly_review_status", ["DRAFT", "FINAL"]);
export const scorecardStatus = pgEnum("scorecard_status", ["DRAFT", "SUBMITTED", "VERIFIED"]);
export const attendanceStatus = pgEnum("attendance_status", [
  "HADIR",
  "IZIN",
  "SAKIT",
  "ALPA",
  "TERLAMBAT",
]);
export const complaintSeverity = pgEnum("complaint_severity", ["RENDAH", "SEDANG", "TINGGI"]);
export const complaintStatus = pgEnum("complaint_status", ["BARU", "DIPROSES", "SELESAI"]);
export const coachingType = pgEnum("coaching_type", ["COACHING", "REWARD", "PIP"]);
export const rewardType = pgEnum("reward_type", ["BONUS", "INSENTIF", "APRESIASI"]);
export const correctiveStatus = pgEnum("corrective_status", ["OPEN", "PROGRESS", "DONE", "VERIFIED"]);
export const employeeGrade = pgEnum("employee_grade", ["A", "B", "C", "D"]);

// ── Master Data Induk ──────────────────────────────────────────────
export const businessUnits = pgTable(
  "business_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("business_units_code_uidx").on(t.code)]
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
    parentDepartmentId: uuid("parent_department_id"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("departments_code_uidx").on(t.code), index("departments_bu_idx").on(t.businessUnitId)]
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("positions_code_uidx").on(t.code), index("positions_dept_idx").on(t.departmentId)]
);

export const salesChannels = pgTable(
  "sales_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    type: channelType("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("sales_channels_code_uidx").on(t.code), index("sales_channels_type_idx").on(t.type)]
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    employeeNumber: varchar("employee_number", { length: 24 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    joinedAt: date("joined_at"),
    status: employeeStatus("status").notNull().default("AKTIF"),
    basicSalary: bigint("basic_salary", { mode: "bigint" }),
    phone: varchar("phone", { length: 32 }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("employees_branch_idx").on(t.branchId),
    index("employees_position_idx").on(t.positionId),
    index("employees_department_idx").on(t.departmentId),
  ]
);

// ── KPI ────────────────────────────────────────────────────────────
export const kpiIndicators = pgTable(
  "kpi_indicators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 48 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    scope: kpiScope("scope").notNull(),
    unit: kpiUnit("unit").notNull(),
    direction: kpiDirection("direction").notNull().default("HIGHER_BETTER"),
    frequency: kpiFrequency("frequency").notNull().default("MONTHLY"),
    formulaKey: varchar("formula_key", { length: 80 }),
    /** Referensi default (departemen/unit/saluran) untuk scorecard & target turunan. */
    defaultScopeRefId: uuid("default_scope_ref_id"),
    description: text("description"),
    defaultWeight: numeric("default_weight", { precision: 5, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("kpi_indicators_code_uidx").on(t.code),
    index("kpi_indicators_scope_idx").on(t.scope),
    index("kpi_indicators_scope_ref_idx").on(t.defaultScopeRefId),
  ]
);

export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => kpiIndicators.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    scopeRefId: uuid("scope_ref_id"),
    periodType: periodType("period_type").notNull().default("MONTHLY"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull().default("0"),
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("kpi_targets_uidx").on(
      t.indicatorId,
      t.branchId,
      t.scopeRefId,
      t.periodType,
      t.periodStart,
      t.periodEnd
    ),
    index("kpi_targets_period_idx").on(t.periodStart, t.periodEnd),
  ]
);

export const kpiActuals = pgTable(
  "kpi_actuals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => kpiIndicators.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    scopeRefId: uuid("scope_ref_id"),
    periodType: periodType("period_type").notNull().default("MONTHLY"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    actualValue: numeric("actual_value", { precision: 18, scale: 4 }).notNull().default("0"),
    source: actualSource("source").notNull().default("MANUAL"),
    status: actualStatus("status").notNull().default("DRAFT"),
    evidenceUrl: text("evidence_url"),
    notes: text("notes"),
    enteredBy: uuid("entered_by").references(() => users.id, { onDelete: "set null" }),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("kpi_actuals_uidx").on(
      t.indicatorId,
      t.branchId,
      t.scopeRefId,
      t.periodType,
      t.periodStart,
      t.periodEnd
    ),
    index("kpi_actuals_period_idx").on(t.periodStart, t.periodEnd),
    index("kpi_actuals_status_idx").on(t.status),
  ]
);

// ── Pendukung ──────────────────────────────────────────────────────
export const marketingSpends = pgTable(
  "marketing_spends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => salesChannels.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("marketing_spends_period_idx").on(t.periodStart, t.periodEnd)]
);

export const customerComplaints = pgTable(
  "customer_complaints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: uuid("order_id"),
    customerId: uuid("customer_id"),
    channel: varchar("channel", { length: 40 }),
    category: varchar("category", { length: 80 }),
    severity: complaintSeverity("severity").notNull().default("SEDANG"),
    description: text("description").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    status: complaintStatus("status").notNull().default("BARU"),
    resolution: text("resolution"),
    ...timestamps,
  },
  (t) => [index("customer_complaints_period_idx").on(t.receivedAt), index("customer_complaints_status_idx").on(t.status)]
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatus("status").notNull().default("HADIR"),
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    lateMinutes: integer("late_minutes").notNull().default(0),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_records_uidx").on(t.employeeId, t.date),
    index("attendance_records_date_idx").on(t.date),
  ]
);

export const sops = pgTable(
  "sops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    version: varchar("version", { length: 16 }).notNull().default("1.0"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("sops_code_uidx").on(t.code)]
);

export const sopChecks = pgTable(
  "sop_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sopId: uuid("sop_id")
      .notNull()
      .references(() => sops.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
    checkedBy: uuid("checked_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("sop_checks_period_idx").on(t.periodStart, t.periodEnd)]
);

// ── Scorecard Harian ───────────────────────────────────────────────
export const dailyScorecards = pgTable(
  "daily_scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    date: date("date").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    totalScore: numeric("total_score", { precision: 6, scale: 2 }).notNull().default("0"),
    status: scorecardStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("daily_scorecards_uidx").on(t.branchId, t.date, t.departmentId),
    index("daily_scorecards_date_idx").on(t.date),
  ]
);

export const dailyScorecardLines = pgTable(
  "daily_scorecard_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scorecardId: uuid("scorecard_id")
      .notNull()
      .references(() => dailyScorecards.id, { onDelete: "cascade" }),
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => kpiIndicators.id, { onDelete: "cascade" }),
    targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull().default("0"),
    actualValue: numeric("actual_value", { precision: 18, scale: 4 }).notNull().default("0"),
    score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("daily_scorecard_lines_card_idx").on(t.scorecardId)]
);

// ── Review Mingguan ────────────────────────────────────────────────
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    weekStart: date("week_start").notNull(),
    weekEnd: date("week_end").notNull(),
    summary: jsonb("summary"),
    decisions: jsonb("decisions"),
    status: weeklyReviewStatus("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("weekly_reviews_uidx").on(t.branchId, t.weekStart)]
);

// ── Review Bulanan ─────────────────────────────────────────────────
export const monthlyReviews = pgTable(
  "monthly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: monthlyReviewStatus("status").notNull().default("DRAFT"),
    companyScore: numeric("company_score", { precision: 6, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("monthly_reviews_uidx").on(t.branchId, t.periodStart)]
);

export const monthlyReviewLines = pgTable(
  "monthly_review_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => monthlyReviews.id, { onDelete: "cascade" }),
    section: reviewSection("section").notNull(),
    refId: uuid("ref_id"),
    indicatorId: uuid("indicator_id").references(() => kpiIndicators.id, { onDelete: "set null" }),
    targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull().default("0"),
    actualValue: numeric("actual_value", { precision: 18, scale: 4 }).notNull().default("0"),
    score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("monthly_review_lines_review_idx").on(t.reviewId)]
);

// ── Individu ───────────────────────────────────────────────────────
export const employeePerformances = pgTable(
  "employee_performances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    kpiScore: numeric("kpi_score", { precision: 6, scale: 2 }).notNull().default("0"),
    sopScore: numeric("sop_score", { precision: 6, scale: 2 }).notNull().default("0"),
    attendanceScore: numeric("attendance_score", { precision: 6, scale: 2 }).notNull().default("0"),
    disciplineScore: numeric("discipline_score", { precision: 6, scale: 2 }).notNull().default("0"),
    finalScore: numeric("final_score", { precision: 6, scale: 2 }).notNull().default("0"),
    grade: employeeGrade("grade"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("employee_performances_uidx").on(t.employeeId, t.periodStart),
    index("employee_performances_period_idx").on(t.periodStart, t.periodEnd),
  ]
);

export const coachingNotes = pgTable(
  "coaching_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    coachId: uuid("coach_id").references(() => employees.id, { onDelete: "set null" }),
    type: coachingType("type").notNull().default("COACHING"),
    topic: varchar("topic", { length: 200 }).notNull(),
    notes: text("notes"),
    nextAction: text("next_action"),
    followUpAt: date("follow_up_at"),
    ...timestamps,
  },
  (t) => [index("coaching_notes_employee_idx").on(t.employeeId)]
);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    type: rewardType("type").notNull().default("BONUS"),
    amount: bigint("amount", { mode: "bigint" }),
    reason: text("reason").notNull(),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("rewards_employee_idx").on(t.employeeId)]
);

export const correctiveActions = pgTable(
  "corrective_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    issue: text("issue").notNull(),
    actionPlan: text("action_plan").notNull(),
    dueDate: date("due_date").notNull(),
    status: correctiveStatus("status").notNull().default("OPEN"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("corrective_actions_employee_idx").on(t.employeeId), index("corrective_actions_status_idx").on(t.status)]
);
