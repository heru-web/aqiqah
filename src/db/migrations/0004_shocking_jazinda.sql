CREATE TYPE "public"."crm_activity_type" AS ENUM('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK');--> statement-breakpoint
CREATE TYPE "public"."crm_stage_type" AS ENUM('OPEN', 'WON', 'LOST');--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"deal_id" uuid,
	"person_id" uuid,
	"organization_id" uuid,
	"type" "crm_activity_type" DEFAULT 'TASK' NOT NULL,
	"title" varchar(200) NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"owner_id" uuid,
	"created_by" uuid,
	"legacy_followup_id" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"value" bigint NOT NULL,
	"source" varchar(40),
	"product_interest" varchar(80),
	"person_id" uuid,
	"organization_id" uuid,
	"owner_id" uuid,
	"expected_close_date" timestamp with time zone,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"legacy_lead_id" uuid,
	"closed_at" timestamp with time zone,
	"lost_reason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"deal_id" uuid,
	"person_id" uuid,
	"organization_id" uuid,
	"body" text NOT NULL,
	"author_id" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"name" varchar(200) NOT NULL,
	"industry" varchar(120),
	"phone" varchar(32),
	"email" varchar(255),
	"city" varchar(80),
	"address" text,
	"notes" text,
	"owner_id" uuid,
	"legacy_customer_id" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"organization_id" uuid,
	"name" varchar(200) NOT NULL,
	"phone" varchar(32),
	"whatsapp" varchar(32),
	"email" varchar(255),
	"job_title" varchar(120),
	"city" varchar(80),
	"notes" text,
	"owner_id" uuid,
	"legacy_customer_id" uuid,
	"legacy_lead_id" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid,
	"changed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT 'slate' NOT NULL,
	"type" "crm_stage_type" DEFAULT 'OPEN' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_person_id_crm_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_organization_id_crm_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stage_id_crm_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_person_id_crm_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_organization_id_crm_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_person_id_crm_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_organization_id_crm_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_organizations" ADD CONSTRAINT "crm_organizations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_organizations" ADD CONSTRAINT "crm_organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_organization_id_crm_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."crm_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_people" ADD CONSTRAINT "crm_people_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_from_stage_id_crm_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."crm_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_to_stage_id_crm_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."crm_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_activities_branch_idx" ON "crm_activities" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "crm_activities_deal_idx" ON "crm_activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_activities_person_idx" ON "crm_activities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "crm_activities_due_idx" ON "crm_activities" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_activities_legacy_uidx" ON "crm_activities" USING btree ("legacy_followup_id");--> statement-breakpoint
CREATE INDEX "crm_deals_branch_idx" ON "crm_deals" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "crm_deals_stage_idx" ON "crm_deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "crm_deals_owner_idx" ON "crm_deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_deals_person_idx" ON "crm_deals" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "crm_deals_org_idx" ON "crm_deals" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deals_legacy_uidx" ON "crm_deals" USING btree ("legacy_lead_id");--> statement-breakpoint
CREATE INDEX "crm_notes_deal_idx" ON "crm_notes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_notes_person_idx" ON "crm_notes" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "crm_notes_org_idx" ON "crm_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_organizations_branch_idx" ON "crm_organizations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "crm_organizations_name_idx" ON "crm_organizations" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_organizations_legacy_uidx" ON "crm_organizations" USING btree ("legacy_customer_id");--> statement-breakpoint
CREATE INDEX "crm_people_branch_idx" ON "crm_people" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "crm_people_org_idx" ON "crm_people" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crm_people_name_idx" ON "crm_people" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_people_legacy_customer_uidx" ON "crm_people" USING btree ("legacy_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_people_legacy_lead_uidx" ON "crm_people" USING btree ("legacy_lead_id");--> statement-breakpoint
CREATE INDEX "crm_pipelines_branch_idx" ON "crm_pipelines" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "crm_stage_history_deal_idx" ON "crm_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_stages_pipeline_idx" ON "crm_stages" USING btree ("pipeline_id","position");