CREATE TYPE "public"."actual_source" AS ENUM('AUTO', 'MANUAL', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."actual_status" AS ENUM('DRAFT', 'SUBMITTED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('HADIR', 'IZIN', 'SAKIT', 'ALPA', 'TERLAMBAT');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('ONLINE', 'OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."coaching_type" AS ENUM('COACHING', 'REWARD', 'PIP');--> statement-breakpoint
CREATE TYPE "public"."complaint_severity" AS ENUM('RENDAH', 'SEDANG', 'TINGGI');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('BARU', 'DIPROSES', 'SELESAI');--> statement-breakpoint
CREATE TYPE "public"."corrective_status" AS ENUM('OPEN', 'PROGRESS', 'DONE', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."employee_grade" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('AKTIF', 'CUTI', 'RESIGN');--> statement-breakpoint
CREATE TYPE "public"."kpi_direction" AS ENUM('HIGHER_BETTER', 'LOWER_BETTER');--> statement-breakpoint
CREATE TYPE "public"."kpi_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."kpi_scope" AS ENUM('COMPANY', 'BUSINESS_UNIT', 'CHANNEL', 'DEPARTMENT', 'POSITION');--> statement-breakpoint
CREATE TYPE "public"."kpi_unit" AS ENUM('CURRENCY', 'COUNT', 'PERCENT', 'RATIO', 'DURATION', 'SCORE');--> statement-breakpoint
CREATE TYPE "public"."monthly_review_status" AS ENUM('DRAFT', 'REVIEW', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."review_section" AS ENUM('COMPANY', 'BUSINESS_UNIT', 'CHANNEL', 'DEPARTMENT', 'INDIVIDUAL');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('BONUS', 'INSENTIF', 'APRESIASI');--> statement-breakpoint
CREATE TYPE "public"."scorecard_status" AS ENUM('DRAFT', 'SUBMITTED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."weekly_review_status" AS ENUM('DRAFT', 'FINAL');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" DEFAULT 'HADIR' NOT NULL,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "coaching_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"coach_id" uuid,
	"type" "coaching_type" DEFAULT 'COACHING' NOT NULL,
	"topic" varchar(200) NOT NULL,
	"notes" text,
	"next_action" text,
	"follow_up_at" date,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrective_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"issue" text NOT NULL,
	"action_plan" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "corrective_status" DEFAULT 'OPEN' NOT NULL,
	"verified_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"channel" varchar(40),
	"category" varchar(80),
	"severity" "complaint_severity" DEFAULT 'SEDANG' NOT NULL,
	"description" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" "complaint_status" DEFAULT 'BARU' NOT NULL,
	"resolution" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_scorecard_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"target_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"actual_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"weight" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"department_id" uuid NOT NULL,
	"total_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"status" "scorecard_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(120) NOT NULL,
	"business_unit_id" uuid,
	"parent_department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employee_performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"kpi_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"sop_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"attendance_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"discipline_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"final_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"grade" "employee_grade",
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"branch_id" uuid NOT NULL,
	"employee_number" varchar(24) NOT NULL,
	"name" varchar(160) NOT NULL,
	"position_id" uuid,
	"department_id" uuid,
	"joined_at" date,
	"status" "employee_status" DEFAULT 'AKTIF' NOT NULL,
	"basic_salary" bigint,
	"phone" varchar(32),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "employees_employee_number_unique" UNIQUE("employee_number")
);
--> statement-breakpoint
CREATE TABLE "kpi_actuals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"branch_id" uuid,
	"scope_ref_id" uuid,
	"period_type" "period_type" DEFAULT 'MONTHLY' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"actual_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"source" "actual_source" DEFAULT 'MANUAL' NOT NULL,
	"status" "actual_status" DEFAULT 'DRAFT' NOT NULL,
	"evidence_url" text,
	"notes" text,
	"entered_by" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(48) NOT NULL,
	"name" varchar(160) NOT NULL,
	"scope" "kpi_scope" NOT NULL,
	"unit" "kpi_unit" NOT NULL,
	"direction" "kpi_direction" DEFAULT 'HIGHER_BETTER' NOT NULL,
	"frequency" "kpi_frequency" DEFAULT 'MONTHLY' NOT NULL,
	"formula_key" varchar(80),
	"description" text,
	"default_weight" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_indicators_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "kpi_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"branch_id" uuid,
	"scope_ref_id" uuid,
	"period_type" "period_type" DEFAULT 'MONTHLY' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"weight" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_review_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"section" "review_section" NOT NULL,
	"ref_id" uuid,
	"indicator_id" uuid,
	"target_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"actual_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"weight" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "monthly_review_status" DEFAULT 'DRAFT' NOT NULL,
	"company_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(120) NOT NULL,
	"department_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"type" "reward_type" DEFAULT 'BONUS' NOT NULL,
	"amount" bigint,
	"reason" text NOT NULL,
	"approved_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "channel_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_channels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sop_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sop_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"checked_by" uuid,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(24) NOT NULL,
	"title" varchar(200) NOT NULL,
	"department_id" uuid,
	"version" varchar(16) DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sops_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"summary" jsonb,
	"decisions" jsonb,
	"status" "weekly_review_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"finalized_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_notes" ADD CONSTRAINT "coaching_notes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_notes" ADD CONSTRAINT "coaching_notes_coach_id_employees_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_complaints" ADD CONSTRAINT "customer_complaints_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_scorecard_lines" ADD CONSTRAINT "daily_scorecard_lines_scorecard_id_daily_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."daily_scorecards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_scorecard_lines" ADD CONSTRAINT "daily_scorecard_lines_indicator_id_kpi_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."kpi_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_scorecards" ADD CONSTRAINT "daily_scorecards_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_scorecards" ADD CONSTRAINT "daily_scorecards_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_scorecards" ADD CONSTRAINT "daily_scorecards_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_performances" ADD CONSTRAINT "employee_performances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_indicator_id_kpi_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."kpi_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_actuals" ADD CONSTRAINT "kpi_actuals_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_indicator_id_kpi_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."kpi_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_spends" ADD CONSTRAINT "marketing_spends_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_spends" ADD CONSTRAINT "marketing_spends_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."sales_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_review_lines" ADD CONSTRAINT "monthly_review_lines_review_id_monthly_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."monthly_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_review_lines" ADD CONSTRAINT "monthly_review_lines_indicator_id_kpi_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."kpi_indicators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_checks" ADD CONSTRAINT "sop_checks_sop_id_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."sops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_checks" ADD CONSTRAINT "sop_checks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_checks" ADD CONSTRAINT "sop_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sops" ADD CONSTRAINT "sops_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_uidx" ON "attendance_records" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "attendance_records_date_idx" ON "attendance_records" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "business_units_code_uidx" ON "business_units" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coaching_notes_employee_idx" ON "coaching_notes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "corrective_actions_employee_idx" ON "corrective_actions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "corrective_actions_status_idx" ON "corrective_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_complaints_period_idx" ON "customer_complaints" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "customer_complaints_status_idx" ON "customer_complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_scorecard_lines_card_idx" ON "daily_scorecard_lines" USING btree ("scorecard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_scorecards_uidx" ON "daily_scorecards" USING btree ("branch_id","date","department_id");--> statement-breakpoint
CREATE INDEX "daily_scorecards_date_idx" ON "daily_scorecards" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_uidx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_bu_idx" ON "departments" USING btree ("business_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_performances_uidx" ON "employee_performances" USING btree ("employee_id","period_start");--> statement-breakpoint
CREATE INDEX "employee_performances_period_idx" ON "employee_performances" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "employees_branch_idx" ON "employees" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "employees_position_idx" ON "employees" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_actuals_uidx" ON "kpi_actuals" USING btree ("indicator_id","branch_id","scope_ref_id","period_type","period_start","period_end");--> statement-breakpoint
CREATE INDEX "kpi_actuals_period_idx" ON "kpi_actuals" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "kpi_actuals_status_idx" ON "kpi_actuals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_indicators_code_uidx" ON "kpi_indicators" USING btree ("code");--> statement-breakpoint
CREATE INDEX "kpi_indicators_scope_idx" ON "kpi_indicators" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_targets_uidx" ON "kpi_targets" USING btree ("indicator_id","branch_id","scope_ref_id","period_type","period_start","period_end");--> statement-breakpoint
CREATE INDEX "kpi_targets_period_idx" ON "kpi_targets" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "marketing_spends_period_idx" ON "marketing_spends" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "monthly_review_lines_review_idx" ON "monthly_review_lines" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_reviews_uidx" ON "monthly_reviews" USING btree ("branch_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_code_uidx" ON "positions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "positions_dept_idx" ON "positions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "rewards_employee_idx" ON "rewards" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_channels_code_uidx" ON "sales_channels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sales_channels_type_idx" ON "sales_channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sop_checks_period_idx" ON "sop_checks" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "sops_code_uidx" ON "sops" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_uidx" ON "weekly_reviews" USING btree ("branch_id","week_start");