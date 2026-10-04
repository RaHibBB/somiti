import { beforeAll, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, profitDistributions, shareHistory, transactions } from "@/lib/db/schema"
import { loadFund } from "@/lib/data"
import { saveDistribution, voidDistribution } from "@/lib/services/profit"
import { createTransaction } from "@/lib/services/transactions"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number

beforeAll(async () => {
  // Pin "today" (Asia/Dhaka) mid-term so test dates are never in the future. Only Date is faked.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2027-06-01T06:00:00Z"))
  ;({ db } = await createTestDb())
  const rows = await db
    .insert(members)
    .values([
      { memberNo: 1, nameBn: "এক", joinedOn: "2026-10-01", role: "admin" },
      { memberNo: 2, nameBn: "দুই", joinedOn: "2026-10-01" },
    ])
    .returning()
  adminId = rows[0].id
  await db.insert(shareHistory).values([
    { memberId: rows[0].id, shares: 1, effectiveMonth: "2026-10-01" },
    { memberId: rows[1].id, shares: 3, effectiveMonth: "2026-10-01" },
  ])
  const base = { approvedBy: null, receiptUrl: null, meetingDate: null, voteResult: null }
  await createTransaction(db, adminId, { ...base, date: "2026-12-01", type: "business_income", description: "লাভ", amount: 8_000 })
})

describe("profit distribution service", () => {
  it("saves once per year, records the dividend, and voids both together", async () => {
    const d = await saveDistribution(db, adminId, 0, { recordDividend: true, paidOn: "2027-05-05" })
    expect(d).toMatchObject({ totalProfit: 8_000, reserveAmount: 4_000, distributedAmount: 4_000 })
    const lines = (d.details as { lines: { amount: number }[] }).lines.map((l) => l.amount)
    expect(lines).toEqual([1_000, 3_000]) // 1:3 share ratio
    expect((await loadFund(db)).byType.dividend).toBe(4_000)

    await expect(saveDistribution(db, adminId, 0, { recordDividend: false, paidOn: "2027-05-05" })).rejects.toThrow("আগেই")

    await voidDistribution(db, adminId, d.id, "ভুল হিসাব")
    expect((await loadFund(db)).byType.dividend).toBe(0)
    const [div] = await db.select().from(transactions).where(eq(transactions.type, "dividend"))
    expect(div.status).toBe("void")

    // After voiding, the year can be saved again.
    const again = await saveDistribution(db, adminId, 0, { recordDividend: false, paidOn: "2027-05-05" })
    expect(again.distributedAmount).toBe(4_000)
  })

  it("two simultaneous saves of the same year produce exactly one distribution", async () => {
    const [d] = await db.select().from(profitDistributions).where(eq(profitDistributions.status, "valid"))
    await voidDistribution(db, adminId, d.id, "আবার পরীক্ষা")
    const results = await Promise.allSettled([
      saveDistribution(db, adminId, 0, { recordDividend: true, paidOn: "2027-05-05" }),
      saveDistribution(db, adminId, 0, { recordDividend: true, paidOn: "2027-05-05" }),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const valid = await db.select().from(profitDistributions).where(eq(profitDistributions.status, "valid"))
    expect(valid).toHaveLength(1)
  })

  it("refuses when there is no profit", async () => {
    await expect(saveDistribution(db, adminId, 1, { recordDividend: false, paidOn: "2027-05-05" })).rejects.toThrow("মুনাফা নেই")
  })
})
