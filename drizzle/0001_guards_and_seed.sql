-- Data-safety guards (spec §2.2): nothing is ever hard-deleted, financial rows are
-- immutable except for a one-way valid → void transition, audit log is insert-only.

CREATE OR REPLACE FUNCTION samiti_forbid_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'DELETE is not allowed on table %. Void the row instead.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION samiti_forbid_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE is not allowed on table % (insert-only).', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
-- Only allowed change to a payment/transaction: status valid → void, filling the void_* columns.
CREATE OR REPLACE FUNCTION samiti_only_void_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  void_cols text[] := ARRAY['status', 'void_reason', 'voided_by', 'voided_at'];
BEGIN
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'Row % in % is already void and cannot be changed.', OLD.id, TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.status <> 'void' THEN
    RAISE EXCEPTION 'Rows in % cannot be edited. Void it and enter a new one.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - void_cols) IS DISTINCT FROM (to_jsonb(OLD) - void_cols) THEN
    RAISE EXCEPTION 'Voiding a row in % may only change the void columns.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION samiti_forbid_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE is not allowed on table %.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION samiti_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  -- No DELETE / TRUNCATE on any table.
  FOREACH t IN ARRAY ARRAY[
    'members', 'share_history', 'settings', 'payments', 'transactions', 'notices',
    'audit_log', 'sheet_outbox', 'proposals', 'votes', 'profit_distributions'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION samiti_forbid_delete()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION samiti_forbid_truncate()', t || '_no_truncate', t);
  END LOOP;

  -- Financial rows: only valid → void.
  FOREACH t IN ARRAY ARRAY['payments', 'transactions', 'profit_distributions'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION samiti_only_void_update()', t || '_only_void', t);
  END LOOP;

  -- Insert-only history tables.
  FOREACH t IN ARRAY ARRAY['audit_log', 'share_history', 'votes'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION samiti_forbid_update()', t || '_no_update', t);
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER members_touch_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION samiti_touch_updated_at();
--> statement-breakpoint
-- Seed the single settings row with the constitution's defaults.
INSERT INTO settings (id, share_price, start_month, due_day, term_months, reserve_pct, max_invest_pct)
VALUES (1, 500, '2026-10-01', 10, 36, 50, 70)
ON CONFLICT (id) DO NOTHING;
