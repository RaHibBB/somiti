CREATE TYPE "public"."report_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "payment_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"items" jsonb NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"trx_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"payment_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reports_amount_positive" CHECK ("payment_reports"."amount" > 0),
	CONSTRAINT "payment_reports_not_cash" CHECK ("payment_reports"."method" <> 'cash'),
	CONSTRAINT "payment_reports_trx_present" CHECK (length(trim("payment_reports"."trx_id")) >= 4)
);
--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_reviewed_by_members_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reports_trx_once" ON "payment_reports" USING btree (upper(trim("trx_id"))) WHERE status <> 'rejected';--> statement-breakpoint
CREATE INDEX "payment_reports_status_idx" ON "payment_reports" USING btree ("status","created_at");