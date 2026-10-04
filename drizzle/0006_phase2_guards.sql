-- Phase 2 guards, enforced in the database like the Phase 1 rules.

-- A vote can only be cast on an open proposal, before it closes, by an active member.
CREATE OR REPLACE FUNCTION samiti_check_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  p proposals%ROWTYPE;
  m_status member_status;
BEGIN
  SELECT * INTO p FROM proposals WHERE id = NEW.proposal_id;
  IF p.status <> 'open' OR (p.closes_at IS NOT NULL AND p.closes_at <= now()) THEN
    RAISE EXCEPTION 'Voting on proposal % is closed.', NEW.proposal_id USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT status INTO m_status FROM members WHERE id = NEW.member_id;
  IF m_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active members can vote.' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER votes_check BEFORE INSERT ON votes FOR EACH ROW EXECUTE FUNCTION samiti_check_vote();
--> statement-breakpoint
-- Once a proposal is open, its text and amount are fixed; only the closing fields may change,
-- and only once. A decided proposal (passed / rejected / invalid) can never change again.
CREATE OR REPLACE FUNCTION samiti_guard_proposal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  close_cols text[] := ARRAY['status', 'active_members_at_close', 'yes_count', 'no_count', 'closed_at', 'closed_by'];
BEGIN
  IF OLD.status IN ('passed', 'rejected', 'invalid') THEN
    RAISE EXCEPTION 'Proposal % is already decided and cannot change.', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'open' THEN
    IF NEW.status NOT IN ('passed', 'rejected', 'invalid') THEN
      RAISE EXCEPTION 'An open proposal can only be closed.' USING ERRCODE = 'restrict_violation';
    END IF;
    IF (to_jsonb(NEW) - close_cols) IS DISTINCT FROM (to_jsonb(OLD) - close_cols) THEN
      RAISE EXCEPTION 'Closing a proposal may only change the result columns.' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER proposals_guard BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION samiti_guard_proposal();
