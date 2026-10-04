-- Read the proposal FOR SHARE when checking a vote. closeProposal() holds the row FOR UPDATE
-- while it counts votes, so a vote arriving during the close now waits, then sees the closed
-- status and is refused — instead of slipping in after the tally was frozen.
CREATE OR REPLACE FUNCTION samiti_check_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  p proposals%ROWTYPE;
  m_status member_status;
BEGIN
  SELECT * INTO p FROM proposals WHERE id = NEW.proposal_id FOR SHARE;
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
