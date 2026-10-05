ALTER TABLE "members" DROP CONSTRAINT "members_phone_format";--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "members_nominee_phone_format";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "phone" SET DATA TYPE varchar(16);--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "nominee_phone" SET DATA TYPE varchar(16);--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_phone_format" CHECK ("members"."phone" IS NULL OR "members"."phone" ~ '^(01[3-9][0-9]{8}|[+][1-9][0-9]{7,14})$');--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_nominee_phone_format" CHECK ("members"."nominee_phone" IS NULL OR "members"."nominee_phone" ~ '^(01[3-9][0-9]{8}|[+][1-9][0-9]{7,14})$');