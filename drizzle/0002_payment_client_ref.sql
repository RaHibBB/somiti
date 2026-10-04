ALTER TABLE "payments" ADD COLUMN "client_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_ref_month" UNIQUE("client_ref","for_month");