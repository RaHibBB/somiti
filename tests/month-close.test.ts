import { beforeAll, describe, expect, it, vi } from "vitest"
import { members } from "@/lib/db/schema"
import type { DB } from "@/lib/db"
import { holderBalances } from "@/lib/holdings"
import { createMember } from "@/lib/services/members"
import { createHandover, voidHandover } from "@/lib/services/handovers"
import { closeMonth, closedMonths, reopenMonth } from "@/lib/services/month-close"
import { recordPayments } from "@/lib/services/payments"
import { voidPayment } from "@/lib/services/void"
import { UserError } from "@/lib/services/errors"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let otherAdminId: number
let memberId: number

const pay = (paidOn: string, forMonth: string, ref: string) => ({
  memberId,
  items: [{ forMonth, amount: 500 }],
  paidOn,
  method: "cash" as const,
  trxId: null,
  note: null,
  clientRef: ref,
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
  const created = await createMember(db, adminId, {
    email: null,
    role: "member",
    joinedOn: "2026-10-01",
    nomineeName: null,
    nomineePhone: null,
    notes: null,
    memberNo: 3,
    nameBn: "রহিম",
    phone: null,
    shares: 1,
    shareStartMonth: "2026-10-01",
  })
  memberId = created.member.id
})

describe("month close", () => {
  it("a closed month refuses new payments and voids; reopening (with a reason) allows them again", async () => {
    const [p] = await recordPayments(db, adminId, pay("2026-10-05", "2026-10-01", "m1"))
    await closeMonth(db, adminId, "2026-10-01")
    expect((await closedMonths(db)).has("2026-10-01")).toBe(true)
    await expect(recordPayments(db, adminId, pay("2026-10-06", "2026-11-01", "m2"))).rejects.toBeInstanceOf(UserError)
    await expect(voidPayment(db, adminId, p.id, "ভুল")).rejects.toBeInstanceOf(UserError)
    // Another month is unaffected.
    await recordPayments(db, adminId, pay("2026-11-05", "2026-11-01", "m3"))
    await expect(closeMonth(db, adminId, "2026-10-01")).rejects.toBeInstanceOf(UserError)
    await expect(reopenMonth(db, adminId, "2026-10-01", " ")).rejects.toBeInstanceOf(UserError)
    await reopenMonth(db, adminId, "2026-10-01", "একটি ভুল ঠিক করতে হবে")
    expect((await closedMonths(db)).has("2026-10-01")).toBe(false)
    await voidPayment(db, adminId, p.id, "ভুল সদস্য")
  })

  it("cannot close a future month", async () => {
    await expect(closeMonth(db, adminId, "2027-09-01")).rejects.toBeInstanceOf(UserError)
  })
})

describe("handovers", () => {
  it("bank deposits and admin-to-admin handovers move the balance; a void restores it", async () => {
    const h1 = await createHandover(db, adminId, { fromId: adminId, toId: null, amount: 300, date: "2026-11-07", note: "ব্যাংকে" })
    await createHandover(db, adminId, { fromId: adminId, toId: otherAdminId, amount: 100, date: "2026-11-08", note: null })
    const pays = [{ receivedBy: adminId, amount: 1000, status: "valid" as const }]
    const handovers = [
      { fromId: adminId, toId: null, amount: 300, status: "valid" as const },
      { fromId: adminId, toId: otherAdminId, amount: 100, status: "valid" as const },
    ]
    const res = holderBalances(pays, handovers)
    expect(res.bankTotal).toBe(300)
    expect(res.holders.find((h) => h.id === adminId)?.balance).toBe(600)
    expect(res.holders.find((h) => h.id === otherAdminId)?.balance).toBe(100)
    const voided = await voidHandover(db, adminId, h1.id, "ভুল অঙ্ক")
    expect(voided.status).toBe("void")
    expect(holderBalances(pays, [{ ...handovers[0], status: "void" }, handovers[1]]).bankTotal).toBe(0)
  })

  it("refuses handing money to yourself, a non-admin or a closed month", async () => {
    await expect(createHandover(db, adminId, { fromId: adminId, toId: adminId, amount: 10, date: "2026-11-08", note: null })).rejects.toBeInstanceOf(UserError)
    await expect(createHandover(db, adminId, { fromId: adminId, toId: memberId, amount: 10, date: "2026-11-08", note: null })).rejects.toBeInstanceOf(UserError)
    await closeMonth(db, adminId, "2026-11-01")
    await expect(createHandover(db, adminId, { fromId: adminId, toId: null, amount: 10, date: "2026-11-09", note: null })).rejects.toBeInstanceOf(UserError)
  })
})
