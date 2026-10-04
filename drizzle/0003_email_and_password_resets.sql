CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "email" varchar(254);--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_resets_member_idx" ON "password_resets" USING btree ("member_id","created_at");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_email_lowercase" CHECK ("members"."email" IS NULL OR "members"."email" = lower("members"."email"));