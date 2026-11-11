ALTER TYPE "public"."lead_source" ADD VALUE 'AFILIATE' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'AGEN' BEFORE 'OTHER';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'WA_BLAST' BEFORE 'OTHER';--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "ayahName" varchar(160);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "ibuName" varchar(160);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "birthPlace" varchar(120);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "birthDate" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "packageName" varchar(160);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deliveryDate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deliverySlot" varchar(40);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "consent" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "address" varchar(255);--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "pen" varchar(80);--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_reads_user_uidx" ON "notification_reads" USING btree ("notification_id","user_id");