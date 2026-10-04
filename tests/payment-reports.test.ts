import { beforeAll, describe, expect, it, vi } from "vitest"
import type { PGlite } from "@electric-sql/pglite"
import type { DB } from "@/lib/db"
import { members, shareHistory } from "@/lib/db/schema"
import { loadSnapshot } from "@/lib/data"
import { approveReport, rejectReport, submitReport } from "@/lib/services/payment-reports"
import { createTestDb } from "./helpers/test-db"

let db: DB
let pg: PGlite
let adminId: number
let member: { id: number; status: "active" }

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-05T06:00:00Z"))
  ;({ db, pg } = await createTestDb())
  const rows = await db
    .insert(members)
    .values([
      { memberNo: 1, nameBn: "অ্যাডমিন", joinedOn: "2026-10-01", role: "admin" },
      { memberNo: 2, nameBn: "সদস্য", joinedOn: "2026-10-01" },
    ])
    .returning()
  adminId = rows[0].id
  member = { id: rows[1].id, status: "active" }
  await db.insert(shareHistory).values({ memberId: member.id, shares: 2, effectiveMonth: "2026-10-01" })
})

const base = { method: "bkash" as const, paidOn: "2026-11-04", note: null }

describe("member-reported payments", () => {
  it("counts nothing until approved; approval creates receipts", async () => {
    const r = await submitReport(db, member, {
      ...base,
      trxId: "abc12345",
      items: [
        { forMonth: "2026-10-01", amount: 1000 },
        { forMonth: "2026-11-01", amount: 1000 },
      ],
    })
    expect(r).toMatchObject({ status: "pending", amount: 2000, trxId: "ABC12345" })
    expect((await loadSnapshot(db, "2026-11-11")).members.find((m) => m.member.id === member.id)!.paid).toBe(0)

    const { payments } = await approveReport(db, adminId, r.id)
    expect(payments.map((p) => [p.forMonth, p.amount, p.trxId])).toEqual([
      ["2026-10-01", 1000, "ABC12345"],
      ["2026-11-01", 1000, "ABC12345"],
    ])
    const m = (await loadSnapshot(db, "2026-11-11")).members.find((x) => x.member.id === member.id)!
    expect(m.paid).toBe(2000)
    expect(m.due).toBe(0)
    await expect(approveReport(db, adminId, r.id)).rejects.toThrow("আগেই")
  })

  it("refuses a transaction id that was already used", async () => {
    await expect(submitReport(db, member, { ...base, trxId: " Abc12345 ", items: [{ forMonth: "2026-12-01", amount: 1000 }] })).rejects.toThrow(
      "আগেই",
    )
  })

  it("rejection needs a reason, frees the trx id, and can't be reviewed twice", async () => {
    const r = await submitReport(db, member, { ...base, trxId: "WRONG999", items: [{ forMonth: "2026-12-01", amount: 1000 }] })
    await expect(rejectReport(db, adminId, r.id, "")).rejects.toThrow("লিখুন")
    await rejectReport(db, adminId, r.id, "বিকাশে এই আইডি পাওয়া যায়নি")
    await expect(approveReport(db, adminId, r.id)).rejects.toThrow("আগেই")
    // After a rejection the member may report the same id again (e.g. a typo fixed elsewhere).
    await expect(submitReport(db, member, { ...base, trxId: "WRONG999", items: [{ forMonth: "2026-12-01", amount: 1000 }] })).resolves.toBeTruthy()
  })

  it("the database refuses deletes and re-reviews", async () => {
    await expect(pg.exec("DELETE FROM payment_reports")).rejects.toThrow(/DELETE is not allowed/)
    await expect(pg.exec("UPDATE payment_reports SET status = 'pending' WHERE status = 'approved'")).rejects.toThrow(/already reviewed/)
  })
})
