CREATE TABLE "counters" (
	"name" varchar(120) PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "counters_updated_idx" ON "counters" USING btree ("updated_at");