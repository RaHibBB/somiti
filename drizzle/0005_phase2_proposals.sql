ALTER TABLE "proposals" ADD COLUMN "yes_count" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "no_count" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "closed_by" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "proposal_id" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_closed_by_members_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;