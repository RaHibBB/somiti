import { beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, sheetOutbox } from "@/lib/db/schema"
import { createMember } from "@/lib/services/members"
import { recordPayments } from "@/lib/services/payments"
import { createTransaction } from "@/lib/services/transactions"
import { voidPayment } from "@/lib/services/void"
import { flushOutbox, fullRewrite, type SheetTarget } from "@/lib/sheets/sync"
import { TABS, type Row, type TabName } from "@/lib/sheets/rows"
import { createTestDb } from "./helpers/test-db"

/** In-memory stand-in for the Google Sheet: data rows per tab, keyed by column A. */
class FakeSheet implements SheetTarget {
  tabs = new Map<TabName, Row[]>()
  failNext = false
  async ensureTabs(tabs: TabName[]) {
    for (const t of tabs) if (!this.tabs.has(t)) this.tabs.set(t, [])
  }
  async upsertRows(tab: TabName, rows: Row[]) {
    if (this.failNext) {
      this.failNext = false
      throw new Error("Sheets API 503")
    }
    const data = this.tabs.get(tab)!
    for (const row of rows) {
      const i = data.findIndex((r) => String(r[0]) === String(row[0]))
      if (i >= 0) data[i] = row
      else data.push(row)
    }
  }
  async rewriteTab(tab: TabName, rows: Row[]) {
    this.tabs.set(tab, [...rows])
  }
}

let db: DB
let adminId: number
let memberId: number
const sheet = new FakeSheet()

beforeAll(async () => {
  // Pin "today" (Asia/Dhaka) mid-term so test dates are never in the future. Only Date is faked.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2027-06-01T06:00:00Z"))
  ;({ db } = await createTestDb())
  const [admin] = await db
    .insert(members)
    .values({ memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" })
    .returning()
  adminId = admin.id
  const { member } = await createMember(db, adminId, {
    memberNo: 2,
    nameBn: "রহিম",
    phone: null,
    email: null,
    role: "member",
    joinedOn: "2026-10-01",
    nomineeName: null,
    nomineePhone: null,
    notes: null,
    shares: 1,
    shareStartMonth: "2026-10-01",
  })
  memberId = member.id
})

const pay = (month: string) =>
  recordPayments(db, adminId, {
    memberId,
    items: [{ forMonth: month, amount: 500 }],
    paidOn: "2026-10-05",
    method: "cash",
    trxId: null,
    note: null,
    clientRef: null,
  })

describe("sheet outbox sync", () => {
  it("pushes members, payments and transactions, then marks the outbox done", async () => {
    await pay("2026-10-01")
    await createTransaction(db, adminId, {
      date: "2026-10-06",
      type: "expense",
      description: "খাতা",
      amount: 100,
      approvedBy: null,
      receiptUrl: null,
      meetingDate: null,
      voteResult: null,
    })
    const res = await flushOutbox(db, sheet)
    expect(res.failed).toBe(0)
    expect(sheet.tabs.get(TABS.payments)).toHaveLength(1)
    expect(sheet.tabs.get(TABS.payments)![0][1]).toBe("R-0001")
    expect(sheet.tabs.get(TABS.transactions)).toHaveLength(1)
    expect(sheet.tabs.get(TABS.members)!.map((r) => r[2])).toContain("রহিম")
    const pending = await db.select().from(sheetOutbox).where(eq(sheetOutbox.status, "pending"))
    expect(pending).toHaveLength(0)
  })

  it("updates a voided payment in place, marked বাতিল", async () => {
    const [p] = await pay("2026-11-01")
    await flushOutbox(db, sheet)
    expect(sheet.tabs.get(TABS.payments)).toHaveLength(2)
    await voidPayment(db, adminId, p.id, "ভুল এন্ট্রি")
    await flushOutbox(db, sheet)
    const rows = sheet.tabs.get(TABS.payments)!
    expect(rows).toHaveLength(2) // no duplicate
    const voided = rows.find((r) => r[0] === p.id)!
    expect(voided[10]).toBe("বাতিল")
    expect(voided[11]).toBe("ভুল এন্ট্রি")
  })

  it("marks rows failed on API errors and retries them when asked", async () => {
    await pay("2026-12-01")
    sheet.failNext = true
    const res = await flushOutbox(db, sheet)
    expect(res.failed).toBeGreaterThan(0)
    const failed = await db.select().from(sheetOutbox).where(eq(sheetOutbox.status, "failed"))
    expect(failed[0].lastError).toContain("503")
    // Normal after()-style flush ignores failed rows; the cron includes them.
    expect((await flushOutbox(db, sheet)).pushed).toBe(0)
    expect((await flushOutbox(db, sheet, { includeFailed: true })).pushed).toBe(failed.length)
    expect(sheet.tabs.get(TABS.payments)).toHaveLength(3)
  })

  it("full rewrite matches the database exactly", async () => {
    sheet.tabs.get(TABS.payments)!.push(["999", "R-9999", "drift"]) // simulate a hand edit
    await fullRewrite(db, sheet)
    const rows = sheet.tabs.get(TABS.payments)!
    expect(rows.map((r) => r[1])).toEqual(["R-0001", "R-0002", "R-0003"])
    expect(sheet.tabs.get(TABS.summary)!.length).toBeGreaterThan(0)
  })
})
