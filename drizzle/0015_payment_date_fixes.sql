CREATE TABLE "payment_date_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"paid_on" date NOT NULL,
	"set_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_date_fixes" ADD CONSTRAINT "payment_date_fixes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_date_fixes" ADD CONSTRAINT "payment_date_fixes_set_by_members_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_date_fixes_payment_idx" ON "payment_date_fixes" USING btree ("payment_id","id");--> statement-breakpoint
-- Insert-only history, like payment_receivers / audit_log: no UPDATE, DELETE or TRUNCATE.
CREATE TRIGGER payment_date_fixes_no_update BEFORE UPDATE ON payment_date_fixes
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_update();
--> statement-breakpoint
CREATE TRIGGER payment_date_fixes_no_delete BEFORE DELETE ON payment_date_fixes
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER payment_date_fixes_no_truncate BEFORE TRUNCATE ON payment_date_fixes
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
