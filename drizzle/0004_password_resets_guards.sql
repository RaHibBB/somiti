-- password_resets follows the same rule as every other table: rows are never deleted.
-- (Expired/used tokens are harmless: only a SHA-256 hash is stored.)
CREATE TRIGGER password_resets_no_delete BEFORE DELETE ON password_resets
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER password_resets_no_truncate BEFORE TRUNCATE ON password_resets
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
