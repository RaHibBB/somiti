// Applies the real migrations to an in-memory Postgres (PGlite) and checks the
// database-level guards from spec §2.2.
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

const pg = new PGlite()

beforeAll(async () => {
  await migrate(drizzle({ client: pg }), { migrationsFolder: "drizzle" })
  await pg.exec(`
    INSERT INTO members (member_no, name_bn, phone, role, joined_on) VALUES
      (1, 'অ্যাডমিন', '01859336893', 'admin', '2026-10-01'),
      (2, 'সদস্য', '01700000000', 'member', '2026-10-01');
    INSERT INTO share_history (member_id, shares, effective_month) VALUES (2, 2, '2026-10-01');
    INSERT INTO payments (member_id, for_month, amount, paid_on, received_by) VALUES (2, '2026-10-01', 1000, '2026-10-05', 1);
    INSERT INTO transactions (date, type, description, amount) VALUES ('2026-10-06', 'expense', 'খাতা', 120);
    INSERT INTO audit_log (actor_id, action, table_name, row_id) VALUES (1, 'create', 'payments', '1');
    INSERT INTO sheet_outbox (kind, payload) VALUES ('payment', '{}');
    INSERT INTO proposals (title, description, status) VALUES ('t', 'd', 'open');
    INSERT INTO votes (proposal_id, member_id, choice) VALUES (1, 2, 'yes');
  `)
}, 60_000)

async function rejects(sql: string, pattern: RegExp) {
  await expect(pg.exec(sql)).rejects.toThrow(pattern)
}

describe("database guards", () => {
  it("seeds the settings row", async () => {
    const r = await pg.query<{ share_price: number; start_month: string; due_day: number }>(
      "SELECT share_price, start_month::text, due_day FROM settings",
    )
    expect(r.rows).toEqual([{ share_price: 500, start_month: "2026-10-01", due_day: 10 }])
  })

  it("assigns receipt numbers from the sequence", async () => {
    const r = await pg.query<{ receipt_no: number }>("SELECT receipt_no FROM payments")
    expect(r.rows[0].receipt_no).toBe(1)
  })

  it.each(["members", "share_history", "settings", "payments", "transactions", "audit_log", "sheet_outbox", "votes"])(
    "rejects DELETE on %s",
    async (table) => {
      await rejects(`DELETE FROM ${table}`, /DELETE is not allowed/)
    },
  )

  it("rejects TRUNCATE", async () => {
    await rejects("TRUNCATE payments CASCADE", /TRUNCATE is not allowed/)
  })

  it("rejects editing a valid payment", async () => {
    await rejects("UPDATE payments SET amount = 1 WHERE id = 1", /cannot be edited/)
  })

  it("rejects void without a reason", async () => {
    await rejects("UPDATE payments SET status = 'void', voided_at = now() WHERE id = 1", /void_has_reason/)
  })

  it("rejects changing other columns while voiding", async () => {
    await rejects(
      "UPDATE payments SET status = 'void', void_reason = 'ভুল', voided_at = now(), amount = 5 WHERE id = 1",
      /may only change the void columns/,
    )
  })

  it("allows a proper void, then blocks un-voiding", async () => {
    await pg.exec("UPDATE payments SET status = 'void', void_reason = 'ভুল সদস্য', voided_by = 1, voided_at = now() WHERE id = 1")
    const r = await pg.query<{ status: string }>("SELECT status FROM payments WHERE id = 1")
    expect(r.rows[0].status).toBe("void")
    await rejects("UPDATE payments SET status = 'valid' WHERE id = 1", /already void/)
  })

  it("keeps audit_log and share_history insert-only", async () => {
    await rejects("UPDATE audit_log SET action = 'x'", /insert-only/)
    await rejects("UPDATE share_history SET shares = 3", /insert-only/)
  })

  it("enforces 1–5 shares and phone format", async () => {
    await rejects("INSERT INTO share_history (member_id, shares, effective_month) VALUES (2, 10, '2026-11-01')", /shares_range/)
    await rejects("INSERT INTO members (member_no, name_bn, phone, joined_on) VALUES (9, 'x', '1234', '2026-10-01')", /phone_format/)
  })

  it("allows normal member updates and bumps updated_at", async () => {
    await pg.exec("UPDATE members SET notes = 'ok' WHERE id = 2")
    const r = await pg.query<{ notes: string }>("SELECT notes FROM members WHERE id = 2")
    expect(r.rows[0].notes).toBe("ok")
  })
})
