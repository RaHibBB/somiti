CREATE TABLE "cash_handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_by" integer NOT NULL,
	"status" "record_status" DEFAULT 'valid' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_handovers_amount_positive" CHECK ("cash_handovers"."amount" > 0),
	CONSTRAINT "cash_handovers_not_to_self" CHECK ("cash_handovers"."to_id" IS NULL OR "cash_handovers"."to_id" <> "cash_handovers"."from_id"),
	CONSTRAINT "cash_handovers_void_has_reason" CHECK ("cash_handovers"."status" = 'valid' OR ("cash_handovers"."void_reason" IS NOT NULL AND length(trim("cash_handovers"."void_reason")) > 0 AND "cash_handovers"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "month_close_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"snapshot" jsonb,
	"by_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_close_first_of_month" CHECK (EXTRACT(DAY FROM "month_close_events"."month") = 1),
	CONSTRAINT "month_reopen_has_reason" CHECK ("month_close_events"."kind" = 'close' OR ("month_close_events"."reason" IS NOT NULL AND length(trim("month_close_events"."reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "month_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"key" text NOT NULL,
	"done_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_tasks_month_key" UNIQUE("month","key")
);
--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_from_id_members_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_to_id_members_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_voided_by_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_close_events" ADD CONSTRAINT "month_close_events_by_id_members_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_tasks" ADD CONSTRAINT "month_tasks_done_by_members_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "month_close_events_month_idx" ON "month_close_events" USING btree ("month","id");--> statement-breakpoint
-- month_close_events: insert-only history (no UPDATE / DELETE / TRUNCATE).
CREATE TRIGGER month_close_events_no_update BEFORE UPDATE ON month_close_events
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_update();
--> statement-breakpoint
CREATE TRIGGER month_close_events_no_delete BEFORE DELETE ON month_close_events
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER month_close_events_no_truncate BEFORE TRUNCATE ON month_close_events
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
--> statement-breakpoint
-- cash_handovers: like payments, a row is only ever voided, never edited or deleted.
CREATE TRIGGER cash_handovers_only_void BEFORE UPDATE ON cash_handovers
  FOR EACH ROW EXECUTE FUNCTION samiti_only_void_update();
--> statement-breakpoint
CREATE TRIGGER cash_handovers_no_delete BEFORE DELETE ON cash_handovers
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER cash_handovers_no_truncate BEFORE TRUNCATE ON cash_handovers
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
