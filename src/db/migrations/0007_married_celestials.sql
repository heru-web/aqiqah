CREATE TYPE "public"."inventory_direction" AS ENUM('IN', 'OUT', 'ADJUST');--> statement-breakpoint
CREATE TYPE "public"."kasbon_status" AS ENUM('PENGAJUAN', 'DISETUJUI', 'DIBAYAR', 'DIBATALKAN');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('DRAFT', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."prod_stage" AS ENUM('RPH', 'POTONG', 'MASAK', 'PACKING', 'QC', 'SIAP');--> statement-breakpoint
CREATE TYPE "public"."qc_status" AS ENUM('PENDING', 'PASS', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."ziswaf_direction" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."ziswaf_kind" AS ENUM('ZAKAT', 'INFAK', 'SEDEKAH', 'WAKAF');--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'GAGAL';--> statement-breakpoint
CREATE TABLE "account_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"opening" bigint DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"orderId" uuid,
	"destination" varchar(240) NOT NULL,
	"contact_name" varchar(120),
	"contact_phone" varchar(32),
	"driver_name" varchar(120),
	"vehicle_plate" varchar(32),
	"scheduled_at" timestamp with time zone,
	"status" "delivery_status" DEFAULT 'WAITING' NOT NULL,
	"tracking_token" varchar(40),
	"delivered_at" timestamp with time zone,
	"notes" varchar(200),
	"created_by" uuid,
	"pod_recipient_name" varchar(160),
	"pod_photo_url" text,
	"pod_signature_url" text,
	"pod_temp_c" integer,
	"pod_geo" varchar(80),
	"pod_checklist" text,
	"pod_notes" varchar(240),
	"pod_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_tasks_tracking_token_unique" UNIQUE("tracking_token")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(40) DEFAULT 'BAHAN' NOT NULL,
	"unit" varchar(24) DEFAULT 'buah' NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"min_qty" integer DEFAULT 0 NOT NULL,
	"location" varchar(140),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"ref_module" varchar(40),
	"ref_id" varchar(64),
	"qty_in" integer NOT NULL,
	"qty_remaining" integer NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"direction" "inventory_direction" NOT NULL,
	"qty" integer NOT NULL,
	"reason" varchar(200),
	"ref_module" varchar(40),
	"ref_id" varchar(64),
	"unit_cost" bigint,
	"total_cost" bigint,
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasbons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" varchar(160) NOT NULL,
	"employee_number" varchar(24) NOT NULL,
	"amount" bigint NOT NULL,
	"reason" varchar(200),
	"status" "kasbon_status" DEFAULT 'PENGAJUAN' NOT NULL,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"repaid_at" timestamp with time zone,
	"note" varchar(200),
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"order_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(16) DEFAULT 'MENUNGGU' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_number" varchar(24) NOT NULL,
	"employee_name" varchar(160) NOT NULL,
	"basic" bigint DEFAULT 0 NOT NULL,
	"allowance" bigint DEFAULT 0 NOT NULL,
	"deduction" bigint DEFAULT 0 NOT NULL,
	"net" bigint DEFAULT 0 NOT NULL,
	"note" varchar(200),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"status" "payroll_status" DEFAULT 'DRAFT' NOT NULL,
	"note" text,
	"total_net" bigint DEFAULT 0 NOT NULL,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" varchar(7) NOT NULL,
	"note" text,
	"closed_by" uuid,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "period_closings_period_unique" UNIQUE("period")
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"orderId" uuid,
	"inventoryItemId" uuid,
	"batch_number" varchar(32) NOT NULL,
	"item_name" varchar(200) NOT NULL,
	"qty_planned" integer DEFAULT 0 NOT NULL,
	"qty_done" integer DEFAULT 0 NOT NULL,
	"waste" integer DEFAULT 0 NOT NULL,
	"stage" "prod_stage" DEFAULT 'RPH' NOT NULL,
	"qc_status" "qc_status" DEFAULT 'PENDING' NOT NULL,
	"notes" varchar(200),
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "wa_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"send_hour" integer DEFAULT 20 NOT NULL,
	"send_minute" integer DEFAULT 0 NOT NULL,
	"phones_csv" text,
	"include_affected" boolean DEFAULT false NOT NULL,
	"target_roles" text DEFAULT 'SUPERADM' NOT NULL,
	"only_weekdays" boolean DEFAULT false NOT NULL,
	"template" text,
	"last_sent_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_alert_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "wa_alerts_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" varchar(32) NOT NULL,
	"recipients" text,
	"message" text,
	"status" varchar(16) DEFAULT 'SENT' NOT NULL,
	"error" varchar(240),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(16) NOT NULL,
	"label" varchar(80) NOT NULL,
	"token" varchar(500) NOT NULL,
	"phone_id" varchar(40),
	"note" varchar(160),
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ziswaf_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"kind" "ziswaf_kind" NOT NULL,
	"direction" "ziswaf_direction" NOT NULL,
	"amount" bigint NOT NULL,
	"party" varchar(200) NOT NULL,
	"event_date" timestamp with time zone DEFAULT now() NOT NULL,
	"note" varchar(200),
	"created_by" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_openings" ADD CONSTRAINT "account_openings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_openings" ADD CONSTRAINT "account_openings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_openings" ADD CONSTRAINT "account_openings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD CONSTRAINT "inventory_moves_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD CONSTRAINT "inventory_moves_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasbons" ADD CONSTRAINT "kasbons_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasbons" ADD CONSTRAINT "kasbons_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasbons" ADD CONSTRAINT "kasbons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tasks" ADD CONSTRAINT "kitchen_tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tasks" ADD CONSTRAINT "kitchen_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_closings" ADD CONSTRAINT "period_closings_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_inventoryItemId_inventory_items_id_fk" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_api_keys" ADD CONSTRAINT "wa_api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ziswaf_entries" ADD CONSTRAINT "ziswaf_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ziswaf_entries" ADD CONSTRAINT "ziswaf_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_openings_branch_account_uidx" ON "account_openings" USING btree ("branch_id","account_id");--> statement-breakpoint
CREATE INDEX "delivery_branch_idx" ON "delivery_tasks" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "delivery_status_idx" ON "delivery_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_items_branch_idx" ON "inventory_items" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "inventory_items_cat_idx" ON "inventory_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "inventory_lots_item_idx" ON "inventory_lots" USING btree ("item_id","received_at");--> statement-breakpoint
CREATE INDEX "inventory_moves_item_idx" ON "inventory_moves" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "kasbons_branch_idx" ON "kasbons" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "kasbons_status_idx" ON "kasbons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kitchen_tasks_order_idx" ON "kitchen_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "kitchen_tasks_status_idx" ON "kitchen_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_lines_run_idx" ON "payroll_lines" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "payroll_runs_branch_idx" ON "payroll_runs" USING btree ("branch_id","period");--> statement-breakpoint
CREATE INDEX "prod_batch_branch_idx" ON "production_batches" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "prod_batch_stage_idx" ON "production_batches" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_alert_rules_code_uidx" ON "wa_alert_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "wa_log_rule_idx" ON "wa_alerts_log" USING btree ("rule_code");--> statement-breakpoint
CREATE INDEX "wa_keys_provider_idx" ON "wa_api_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ziswaf_branch_idx" ON "ziswaf_entries" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "ziswaf_kind_idx" ON "ziswaf_entries" USING btree ("kind");