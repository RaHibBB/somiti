-- payment_reports: never deleted; a report is reviewed exactly once (pending → approved / rejected),
-- and reviewing may only fill in the review columns.
CREATE OR REPLACE FUNCTION samiti_guard_payment_report() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  review_cols text[] := ARRAY['status', 'reviewed_by', 'reviewed_at', 'reject_reason', 'payment_ids'];
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment report % was already reviewed.', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.status = 'pending' THEN
    RAISE EXCEPTION 'A payment report can only be approved or rejected.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - review_cols) IS DISTINCT FROM (to_jsonb(OLD) - review_cols) THEN
    RAISE EXCEPTION 'Reviewing a payment report may only change the review columns.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.status = 'rejected' AND (NEW.reject_reason IS NULL OR length(trim(NEW.reject_reason)) = 0) THEN
    RAISE EXCEPTION 'A rejection needs a reason.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_reports_guard BEFORE UPDATE ON payment_reports
  FOR EACH ROW EXECUTE FUNCTION samiti_guard_payment_report();
--> statement-breakpoint
CREATE TRIGGER payment_reports_no_delete BEFORE DELETE ON payment_reports
  FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER payment_reports_no_truncate BEFORE TRUNCATE ON payment_reports
  FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate();
