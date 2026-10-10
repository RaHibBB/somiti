CREATE TABLE "payment_receivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"set_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_receivers" ADD CONSTRAINT "payment_receivers_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receivers" ADD CONSTRAINT "payment_receivers_receiver_id_members_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receivers" ADD CONSTRAINT "payment_receivers_set_by_members_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_receivers_payment_idx" ON "payment_receivers" USING btree ("payment_id","id");--> statement-breakpoint
-- Insert-only history, like audit_log / share_history / votes: no UPDATE, DELETE or TRUNCATE.
CREATE TRIGGER payment_receivers_no_update BEFORE UPDATE ON payment_receivers
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_update();
--> statement-breakpoint
CREATE TRIGGER payment_receivers_no_delete BEFORE DELETE ON payment_receivers
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER payment_receivers_no_truncate BEFORE TRUNCATE ON payment_receivers
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
