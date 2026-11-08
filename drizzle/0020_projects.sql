CREATE TABLE "project_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text NOT NULL,
	"event_date" date NOT NULL,
	"reason" text,
	"by_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_reopen_has_reason" CHECK ("project_events"."kind" = 'close' OR ("project_events"."reason" IS NOT NULL AND length(trim("project_events"."reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"proposal_id" integer,
	"budget" integer,
	"started_on" date NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_not_blank" CHECK (length(trim("projects"."name")) > 0),
	CONSTRAINT "projects_budget_positive" CHECK ("projects"."budget" IS NULL OR "projects"."budget" > 0)
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_by_id_members_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_events_project_idx" ON "project_events" USING btree ("project_id","id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_project_idx" ON "transactions" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_types" CHECK ("transactions"."project_id" IS NULL OR "transactions"."type" IN ('investment', 'expense', 'business_income'));--> statement-breakpoint
-- projects: never deleted (their transactions point at them).
CREATE TRIGGER projects_no_delete BEFORE DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER projects_no_truncate BEFORE TRUNCATE ON projects
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
--> statement-breakpoint
-- project_events: insert-only history (no UPDATE / DELETE / TRUNCATE).
CREATE TRIGGER project_events_no_update BEFORE UPDATE ON project_events
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_update();
--> statement-breakpoint
CREATE TRIGGER project_events_no_delete BEFORE DELETE ON project_events
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER project_events_no_truncate BEFORE TRUNCATE ON project_events
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
