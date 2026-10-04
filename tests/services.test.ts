import { beforeAll, describe, expect, it, vi } from "vitest"
import { count, eq } from "drizzle-orm"
import { auditLog, members, payments, sheetOutbox } from "@/lib/db/schema"
import type { DB } from "@/lib/db"
import { loadFund, loadSnapshot } from "@/lib/data"
import { cancelMember, changeShares, createMember, resetPin, updateMember } from "@/lib/services/members"
import { recordPayments } from "@/lib/services/payments"
import { createTransaction } from "@/lib/services/transactions"
import { voidPayment, voidTransaction } from "@/lib/services/void"
import { UserError } from "@/lib/services/errors"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let memberId: number

const base = {
  email: null,
  role: "member" as const,
  joinedOn: "2026-10-01",
  nomineeName: null,
  nomineePhone: null,
  notes: null,
}

beforeAll(async () => {
  // Pin "today" (Asia/Dhaka) mid-term so test dates are never in the future. Only Date is faked.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2027-06-01T06:00:00Z"))
  ;({ db } = await createTestDb())
  // Bootstrap the first admin directly (no actor yet).
  const [admin] = await db
    .insert(members)
    .values({ memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" })
    .returning()
  adminId = admin.id
  const created = await createMember(db, adminId, {
    ...base,
    memberNo: 2,
    nameBn: "রহিম",
    phone: "01711111111",
    shares: 2,
    shareStartMonth: "2026-10-01",
  })
  memberId = created.member.id
  expect(created.pin).toMatch(/^\d{6}$/)
})

describe("members", () => {
  it("rejects duplicate member numbers and phones with Bengali messages", async () => {
    await expect(
      createMember(db, adminId, { ...base, memberNo: 2, nameBn: "x", phone: null, shares: 1, shareStartMonth: "2026-10-01" }),
    ).rejects.toThrow("এই সদস্য নম্বর আগেই আছে।")
    await expect(
      createMember(db, adminId, { ...base, memberNo: 3, nameBn: "x", phone: "01711111111", shares: 1, shareStartMonth: "2026-10-01" }),
    ).rejects.toThrow("মোবাইল নম্বর")
  })

  it("rejects zero shares (there is no upper limit)", async () => {
    await expect(changeShares(db, adminId, memberId, 0, "2027-06-01")).rejects.toBeInstanceOf(UserError)
  })

  it("does not allow demoting the last admin", async () => {
    await expect(
      updateMember(db, adminId, adminId, { ...base, memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893" }),
    ).rejects.toThrow("অ্যাডমিন")
  })

  it("resets a PIN and bumps the session version", async () => {
    const before = (await db.select().from(members).where(eq(members.id, memberId)))[0]
    const { pin, member } = await resetPin(db, adminId, memberId)
    expect(pin).toMatch(/^\d{6}$/)
    expect(member.sessionVersion).toBe(before.sessionVersion + 1)
    expect(member.mustChangePin).toBe(true)
  })
})

describe("payments", () => {
  it("records multiple months with sequential receipts, audit and outbox rows", async () => {
    const auditBefore = (await db.select({ n: count() }).from(auditLog))[0].n
    const outboxBefore = (await db.select({ n: count() }).from(sheetOutbox))[0].n
    const rows = await recordPayments(db, adminId, {
      memberId,
      items: [
        { forMonth: "2026-10-01", amount: 1000 },
        { forMonth: "2026-11-01", amount: 1000 },
      ],
      paidOn: "2026-11-05",
      method: "bkash",
      trxId: "ABC123",
      note: null,
      clientRef: "ref-1",
    })
    expect(rows.map((r) => r.forMonth)).toEqual(["2026-10-01", "2026-11-01"])
    expect(rows[1].receiptNo).toBe(rows[0].receiptNo + 1)
    expect((await db.select({ n: count() }).from(auditLog))[0].n).toBe(auditBefore + 2)
    expect((await db.select({ n: count() }).from(sheetOutbox))[0].n).toBe(outboxBefore + 2)
  })

  it("is idempotent for the same clientRef", async () => {
    const again = await recordPayments(db, adminId, {
      memberId,
      items: [
        { forMonth: "2026-10-01", amount: 1000 },
        { forMonth: "2026-11-01", amount: 1000 },
      ],
      paidOn: "2026-11-05",
      method: "bkash",
      trxId: "ABC123",
      note: null,
      clientRef: "ref-1",
    })
    expect(again).toHaveLength(2)
    expect((await db.select({ n: count() }).from(payments))[0].n).toBe(2)
  })

  it("a retry with a reused key but different details is refused, never answered with another receipt", async () => {
    await expect(
      recordPayments(db, adminId, {
        memberId,
        items: [{ forMonth: "2026-10-01", amount: 1000 }],
        paidOn: "2026-11-05",
        method: "bkash",
        trxId: "ABC123",
        note: null,
        clientRef: "ref-1",
      }),
    ).rejects.toThrow("মিলছে না")
  })

  it("voids a payment, which then drops out of totals", async () => {
    const snap1 = await loadSnapshot(db, "2026-12-11")
    const m1 = snap1.members.find((m) => m.member.id === memberId)!
    expect(m1.paid).toBe(2000)
    expect(m1.due).toBe(1000) // Oct, Nov, Dec at 1000 − 2000 paid

    const [first] = await db.select().from(payments).where(eq(payments.forMonth, "2026-10-01"))
    await expect(voidPayment(db, adminId, first.id, "")).rejects.toThrow("কারণ")
    await voidPayment(db, adminId, first.id, "ভুল সদস্যের নামে")
    await expect(voidPayment(db, adminId, first.id, "আবার")).rejects.toThrow("আগেই")

    const snap2 = await loadSnapshot(db, "2026-12-11")
    const m2 = snap2.members.find((m) => m.member.id === memberId)!
    expect(m2.paid).toBe(1000)
    expect(m2.due).toBe(2000)
    expect(m2.payments.find((p) => p.id === first.id)?.status).toBe("void") // still visible
  })

  it("refuses payments for cancelled members", async () => {
    await cancelMember(db, adminId, memberId, "৩ মাস চাঁদা দেননি")
    await expect(
      recordPayments(db, adminId, {
        memberId,
        items: [{ forMonth: "2026-12-01", amount: 1000 }],
        paidOn: "2026-12-05",
        method: "cash",
        trxId: null,
        note: null,
        clientRef: null,
      }),
    ).rejects.toThrow("বাতিল")
  })
})

describe("transactions and fund", () => {
  it("creates and voids a transaction; fund excludes the void", async () => {
    const t = await createTransaction(db, adminId, {
      date: "2026-12-01",
      type: "expense",
      description: "খাতা",
      amount: 200,
      approvedBy: null,
      receiptUrl: null,
      meetingDate: null,
      voteResult: null,
    })
    expect((await loadFund(db)).cash).toBe(1000 - 200)
    await voidTransaction(db, adminId, t.id, "দুইবার লেখা হয়েছে")
    expect((await loadFund(db)).cash).toBe(1000)
  })
})

describe("data-entry guards", () => {
  it("rejects future payment dates and months outside the term", async () => {
    const { member } = await createMember(db, adminId, {
      ...base,
      memberNo: 30,
      nameBn: "নতুন",
      phone: null,
      shares: 1,
      shareStartMonth: "2026-10-01",
    })
    const pay = (forMonth: string, paidOn: string) =>
      recordPayments(db, adminId, { memberId: member.id, items: [{ forMonth, amount: 500 }], paidOn, method: "cash", trxId: null, note: null, clientRef: null })
    await expect(pay("2027-01-01", "2027-06-02")).rejects.toThrow("ভবিষ্যতের")
    await expect(pay("2026-09-01", "2027-05-01")).rejects.toThrow("মেয়াদের বাইরে")
    await expect(pay("2029-10-01", "2027-05-01")).rejects.toThrow("মেয়াদের বাইরে")
    await expect(pay("2029-09-01", "2027-05-01")).resolves.toHaveLength(1) // advance for the last term month is fine
  })

  it("never rewrites past months' shares, except for a member with no share history", async () => {
    await expect(changeShares(db, adminId, memberId, 2, "2027-01-01")).rejects.toThrow("আগের মাসের")
    await expect(changeShares(db, adminId, memberId, 2, "2027-06-01")).resolves.toBeTruthy()
    const [blank] = await db.insert(members).values({ memberNo: 31, nameBn: "ফ্ল্যাগড", joinedOn: "2026-10-01" }).returning()
    await expect(changeShares(db, adminId, blank.id, 5, "2026-10-01")).resolves.toBeTruthy()
  })

  it("rejects future transaction dates", async () => {
    await expect(
      createTransaction(db, adminId, {
        date: "2027-07-01",
        type: "expense",
        description: "x",
        amount: 1,
        approvedBy: null,
        receiptUrl: null,
        meetingDate: null,
        voteResult: null,
      }),
    ).rejects.toThrow("ভবিষ্যতের")
  })
})
