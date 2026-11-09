ALTER TABLE "members" DROP CONSTRAINT "members_phone_unique";--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");