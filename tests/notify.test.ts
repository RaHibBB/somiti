import { beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, notifications, proposals } from "@/lib/db/schema"
import { notify } from "@/lib/notify"
import { dailyNotifications } from "@/lib/services/daily-notify"
import { createMember } from "@/lib/services/members"
import { recordPayments } from "@/lib/services/payments"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let paidId: number
let unpaidId: number
let quietId: number

const newMember = (memberNo: number, nameBn: string) =>
  createMember(db, adminId, {
    email: null,
    role: "member",
    joinedOn: "2026-10-01",
    nomineeName: null,
    nomineePhone: null,
    notes: null,
    memberNo,
    nameBn,
    phone: null,
    shares: 1,
    shareStartMonth: "2026-10-01",
  })

const pay = (memberId: number, forMonth: string, paidOn: string, receivedBy?: number) =>
  recordPayments(db, adminId, { memberId, items: [{ forMonth, amount: 500 }], paidOn, method: "cash", trxId: null, note: null, clientRef: null, receivedBy })

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-12-03T06:00:00Z"))
  ;({ db } = await createTestDb())
  const [a] = await db.insert(members).values({ memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" }).returning()
  adminId = a.id
  // The admin pays too, so only the three members below are ever "due".
  await pay(adminId, "2026-10-01", "2026-10-02")
  await pay(adminId, "2026-11-01", "2026-11-02")
  await pay(adminId, "2026-12-01", "2026-12-01")
  paidId = (await newMember(2, "পরিশোধিত")).member.id
  unpaidId = (await newMember(3, "বাকি")).member.id
  quietId = (await newMember(4, "চুপচাপ")).member.id
  await pay(paidId, "2026-10-01", "2026-10-05")
  await pay(paidId, "2026-11-01", "2026-11-05")
  await pay(unpaidId, "2026-10-01", "2026-10-05")
  await pay(quietId, "2026-10-01", "2026-10-05")
  await pay(quietId, "2026-11-01", "2026-11-05")
  await db.update(members).set({ notifyOff: ["due"] }).where(eq(members.id, quietId))
})

describe("notify()", () => {
  it("stores for active members, skips opted-out kinds unless forced, and never sends a dedupe key twice", async () => {
    const first = await notify(db, [
      { memberId: paidId, kind: "notice", title: "ক", body: "খ", dedupeKey: "test:1" },
      { memberId: quietId, kind: "due", title: "ক", body: "খ" },
    ])
    expect(first.map((n) => n.memberId)).toEqual([paidId])
    expect(await notify(db, [{ memberId: paidId, kind: "notice", title: "ক", body: "খ", dedupeKey: "test:1" }])).toHaveLength(0)
    expect(await notify(db, [{ memberId: quietId, kind: "due", title: "পরীক্ষা", body: "খ", force: true }])).toHaveLength(1)
  })

  it("skips cancelled members", async () => {
    const [gone] = await db.insert(members).values({ memberNo: 9, nameBn: "বাতিল", joinedOn: "2026-10-01", status: "cancelled", cancelledAt: new Date(), cancelReason: "পরীক্ষা" }).returning()
    expect(await notify(db, [{ memberId: gone.id, kind: "notice", title: "ক", body: "খ" }])).toHaveLength(0)
  })
})

describe("daily reminders", () => {
  it("8th–10th: this month still unpaid", async () => {
    const items = await dailyNotifications(db, "2026-11-08", new Date("2026-11-08T03:00:00Z"))
    const due = items.filter((i) => i.kind === "due")
    expect(due.map((i) => i.memberId).sort()).toEqual([unpaidId]) // paid and quiet have paid November
    expect(due[0].dedupeKey).toBe(`due-soon:2026-11:${unpaidId}`)
    expect(await dailyNotifications(db, "2026-11-07", new Date("2026-11-07T03:00:00Z"))).toHaveLength(0)
  })

  it("11th–15th: overdue; opted-out members get nothing; a second run sends nothing new", async () => {
    const items = await dailyNotifications(db, "2026-12-11", new Date("2026-12-11T03:00:00Z"))
    const due = items.filter((i) => i.kind === "due")
    // Unpaid owes Nov + Dec, paid and quiet owe Dec; the admin paid everything.
    expect(due.map((i) => i.memberId).sort((a, b) => a - b)).toEqual([paidId, unpaidId, quietId].sort((a, b) => a - b))
    const sent = await notify(db, items)
    expect(sent.some((n) => n.memberId === quietId)).toBe(false)
    expect(await notify(db, await dailyNotifications(db, "2026-12-11", new Date("2026-12-11T03:00:00Z")))).toHaveLength(0)
  })

  it("1st–3rd: admins still holding last month's cash", async () => {
    // Payments recorded by the admin default to "received by" that admin; November's are still in hand.
    const items = await dailyNotifications(db, "2026-12-02", new Date("2026-12-02T03:00:00Z"))
    const cash = items.filter((i) => i.kind === "admin")
    expect(cash).toHaveLength(1)
    expect(cash[0]).toMatchObject({ memberId: adminId, dedupeKey: "cash:2026-11:" + adminId, url: "/admin/holdings?month=2026-11" })
  })

  it("votes closing within a day remind those who haven't voted", async () => {
    const now = new Date("2026-12-05T03:00:00Z")
    const [p] = await db
      .insert(proposals)
      .values({ title: "গরু কেনা", description: "প্রস্তাব", status: "open", opensAt: now, closesAt: new Date(now.getTime() + 20 * 3600 * 1000), createdBy: adminId })
      .returning()
    const items = (await dailyNotifications(db, "2026-12-05", now)).filter((i) => i.kind === "vote")
    expect(items.length).toBe(4)
    expect(items.every((i) => i.url === `/proposals/${p.id}`)).toBe(true)
  })

  it("inbox rows exist for what was sent", async () => {
    const rows = await db.select().from(notifications).where(eq(notifications.memberId, unpaidId))
    expect(rows.length).toBeGreaterThan(0)
  })
})
