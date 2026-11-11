ALTER TABLE "leads" ADD COLUMN "business_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "business_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "business_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "business_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "kpi_indicators" ADD COLUMN "default_scope_ref_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."sales_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_id_sales_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."sales_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpi_indicators_scope_ref_idx" ON "kpi_indicators" USING btree ("default_scope_ref_id");