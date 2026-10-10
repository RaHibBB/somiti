import { sql } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { members } from "@/lib/db/schema"
import type { DB } from "@/lib/db"
import { createMember } from "@/lib/services/members"
import { changeReceiver, fixPaymentDates, recordPayments } from "@/lib/services/payments"
import { loadSnapshot } from "@/lib/data"
import { auditLog, payments } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { UserError } from "@/lib/services/errors"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let otherAdminId: number
let memberId: number

const base = { email: null, role: "member" as const, joinedOn: "2026-10-01", nomineeName: null, nomineePhone: null, notes: null }
const pay = (extra: { receivedBy?: number }, ref: string) => ({
  memberId,
  items: [{ forMonth: "2026-10-01", amount: 500 }],
  paidOn: "2026-11-05",
  method: "cash" as const,
  trxId: null,
  note: null,
  clientRef: ref,
  ...extra,
})

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2027-06-01T06:00:00Z"))
  ;({ db } = await createTestDb())
  const [a, b] = await db
    .insert(members)
    .values([
      { memberNo: 1, nameBn: "অ্যাডমিন এক", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" },
      { memberNo: 2, nameBn: "অ্যাডমিন দুই", phone: "01711111111", role: "admin", joinedOn: "2026-10-01" },
    ])
    .returning()
  adminId = a.id
  otherAdminId = b.id
  const created = await createMember(db, adminId, { ...base, memberNo: 3, nameBn: "রহিম", phone: null, shares: 1, shareStartMonth: "2026-10-01" })
  memberId = created.member.id
})

describe("received-by", () => {
  it("defaults to the admin who enters the payment", async () => {
    const [row] = await recordPayments(db, adminId, pay({}, "r1"))
    expect(row.receivedBy).toBe(adminId)
  })

  it("records another admin as the one holding the money", async () => {
    const [row] = await recordPayments(db, adminId, { ...pay({ receivedBy: otherAdminId }, "r2"), items: [{ forMonth: "2026-11-01", amount: 500 }] })
    expect(row.receivedBy).toBe(otherAdminId)
  })

  it("refuses a receiver who is not an active admin", async () => {
    await expect(
      recordPayments(db, adminId, { ...pay({ receivedBy: memberId }, "r3"), items: [{ forMonth: "2026-12-01", amount: 500 }] }),
    ).rejects.toBeInstanceOf(UserError)
  })

  it("a correction changes who holds the money without touching the payment row, and is audited", async () => {
    const [row] = await recordPayments(db, adminId, { ...pay({}, "r4"), items: [{ forMonth: "2027-01-01", amount: 500 }] })
    expect(await changeReceiver(db, adminId, [row.id], otherAdminId)).toBe(1)
    // The payment row itself is unchanged …
    const [raw] = await db.select().from(payments).where(eq(payments.id, row.id))
    expect(raw.receivedBy).toBe(adminId)
    // … but the ledger snapshot reports the corrected holder.
    const snap = await loadSnapshot(db)
    const eff = snap.members.flatMap((m) => m.payments).find((p) => p.id === row.id)
    expect(eff?.receivedBy).toBe(otherAdminId)
    // Same target again is a no-op; the change is in the audit log.
    expect(await changeReceiver(db, adminId, [row.id], otherAdminId)).toBe(0)
    const logs = await db.select().from(auditLog).where(eq(auditLog.action, "payment_receiver_change"))
    expect(logs).toHaveLength(1)
  })

  it("a date correction is shown everywhere but leaves the payment row and receipt untouched", async () => {
    const [row] = await recordPayments(db, adminId, { ...pay({}, "r5"), items: [{ forMonth: "2027-02-01", amount: 500 }], paidOn: "2026-11-05" })
    expect(await fixPaymentDates(db, adminId, [row.id], "2026-11-01")).toBe(1)
    const [raw] = await db.select().from(payments).where(eq(payments.id, row.id))
    expect(raw.paidOn).toBe("2026-11-05")
    const eff = (await loadSnapshot(db)).members.flatMap((m) => m.payments).find((p) => p.id === row.id)
    expect(eff?.paidOn).toBe("2026-11-01")
    expect(eff?.receiptNo).toBe(row.receiptNo)
    expect(await fixPaymentDates(db, adminId, [row.id], "2026-11-01")).toBe(0)
    await expect(fixPaymentDates(db, adminId, [row.id], "2999-01-01")).rejects.toBeInstanceOf(UserError)
  })

  it("history rows cannot be edited or deleted", async () => {
    await expect(db.execute(sql`UPDATE payment_receivers SET receiver_id = ${adminId}`)).rejects.toThrow()
    await expect(db.execute(sql`UPDATE payment_date_fixes SET paid_on = '2026-01-01'`)).rejects.toThrow()
    await expect(db.execute(sql`DELETE FROM payment_receivers`)).rejects.toThrow()
  })
})
