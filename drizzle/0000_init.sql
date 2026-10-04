CREATE TYPE "public"."member_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notice_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bkash', 'nagad', 'rocket', 'bank');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'open', 'passed', 'rejected', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('valid', 'void');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."txn_type" AS ENUM('expense', 'investment', 'business_income', 'investment_return', 'bank_profit', 'member_refund', 'dividend');--> statement-breakpoint
CREATE TYPE "public"."vote_choice" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE SEQUENCE "public"."receipt_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"row_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_no" integer NOT NULL,
	"name_bn" text NOT NULL,
	"phone" varchar(11),
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_on" date NOT NULL,
	"nominee_name" text,
	"nominee_phone" varchar(11),
	"pin_hash" text,
	"must_change_pin" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"session_version" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_no_unique" UNIQUE("member_no"),
	CONSTRAINT "members_phone_unique" UNIQUE("phone"),
	CONSTRAINT "members_phone_format" CHECK ("members"."phone" IS NULL OR "members"."phone" ~ '^01[3-9][0-9]{8}$'),
	CONSTRAINT "members_nominee_phone_format" CHECK ("members"."nominee_phone" IS NULL OR "members"."nominee_phone" ~ '^01[3-9][0-9]{8}$'),
	CONSTRAINT "members_member_no_positive" CHECK ("members"."member_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "notice_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_no" integer DEFAULT nextval('receipt_no_seq') NOT NULL,
	"member_id" integer NOT NULL,
	"for_month" date NOT NULL,
	"amount" integer NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"trx_id" text,
	"received_by" integer,
	"note" text,
	"status" "record_status" DEFAULT 'valid' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_receipt_no_unique" UNIQUE("receipt_no"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_first_of_month" CHECK (EXTRACT(DAY FROM "payments"."for_month") = 1),
	CONSTRAINT "payments_void_has_reason" CHECK ("payments"."status" = 'valid' OR ("payments"."void_reason" IS NOT NULL AND length(trim("payments"."void_reason")) > 0 AND "payments"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "profit_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_label" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_profit" integer NOT NULL,
	"reserve_amount" integer NOT NULL,
	"distributed_amount" integer NOT NULL,
	"details" jsonb,
	"created_by" integer,
	"status" "record_status" DEFAULT 'valid' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer,
	"created_by" integer,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"active_members_at_close" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_amount_positive" CHECK ("proposals"."amount" IS NULL OR "proposals"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"share_price" integer DEFAULT 500 NOT NULL,
	"start_month" date DEFAULT '2026-10-01' NOT NULL,
	"due_day" smallint DEFAULT 10 NOT NULL,
	"term_months" smallint DEFAULT 36 NOT NULL,
	"reserve_pct" smallint DEFAULT 50 NOT NULL,
	"max_invest_pct" smallint DEFAULT 70 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_due_day_range" CHECK ("settings"."due_day" BETWEEN 1 AND 28),
	CONSTRAINT "settings_start_first_of_month" CHECK (EXTRACT(DAY FROM "settings"."start_month") = 1)
);
--> statement-breakpoint
CREATE TABLE "share_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"shares" smallint NOT NULL,
	"effective_month" date NOT NULL,
	"set_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_history_shares_range" CHECK ("share_history"."shares" BETWEEN 1 AND 5),
	CONSTRAINT "share_history_first_of_month" CHECK (EXTRACT(DAY FROM "share_history"."effective_month") = 1)
);
--> statement-breakpoint
CREATE TABLE "sheet_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"type" "txn_type" NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"approved_by" text,
	"created_by" integer,
	"receipt_url" text,
	"meeting_date" date,
	"vote_result" text,
	"status" "record_status" DEFAULT 'valid' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_void_has_reason" CHECK ("transactions"."status" = 'valid' OR ("transactions"."void_reason" IS NOT NULL AND length(trim("transactions"."void_reason")) > 0 AND "transactions"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"choice" "vote_choice" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_one_per_member" UNIQUE("proposal_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_members_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_distributions" ADD CONSTRAINT "profit_distributions_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_distributions" ADD CONSTRAINT "profit_distributions_voided_by_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_history" ADD CONSTRAINT "share_history_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_history" ADD CONSTRAINT "share_history_set_by_members_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voided_by_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_member_idx" ON "payments" USING btree ("member_id","for_month");--> statement-breakpoint
CREATE INDEX "share_history_member_idx" ON "share_history" USING btree ("member_id","effective_month");--> statement-breakpoint
CREATE INDEX "sheet_outbox_status_idx" ON "sheet_outbox" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");