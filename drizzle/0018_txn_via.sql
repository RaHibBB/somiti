CREATE TYPE "public"."txn_via" AS ENUM('bank', 'cash');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "via" "txn_via" DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cash_holder_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_holder_id_members_id_fk" FOREIGN KEY ("cash_holder_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_has_holder" CHECK ("transactions"."via" = 'bank' OR "transactions"."cash_holder_id" IS NOT NULL);