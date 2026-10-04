import { describe, expect, it } from "vitest"
import {
  addMonths,
  allMonths,
  dueForMember,
  dueReminder,
  expectedForMember,
  fundSummary,
  memberMonths,
  monthsDue,
  oldestUnpaidMonth,
  overdueMonths,
  paidForMember,
  sharesForMonth,
  trailingMissedMonths,
  type LedgerSettings,
  type PaymentRow,
  type ShareRow,
} from "@/lib/ledger"

const S: LedgerSettings = { sharePrice: 500, startMonth: "2026-10-01", dueDay: 10, termMonths: 36 }
const shares = (...rows: [number, string][]): ShareRow[] => rows.map(([s, m], i) => ({ shares: s, effectiveMonth: m, id: i + 1 }))
const pay = (forMonth: string, amount: number, status: "valid" | "void" = "valid"): PaymentRow => ({ forMonth, amount, status })

describe("months", () => {
  it("adds months across years", () => {
    expect(addMonths("2026-10-01", 3)).toBe("2027-01-01")
    expect(addMonths("2027-01-01", -1)).toBe("2026-12-01")
  })

  it("generates the term dynamically", () => {
    const months = allMonths(S, "2026-10-04")
    expect(months).toHaveLength(36)
    expect(months[0]).toBe("2026-10-01")
    expect(months[35]).toBe("2029-09-01")
    expect(allMonths({ ...S, termMonths: 12 }, "2026-10-04")).toHaveLength(12)
    // Running past the term extends to the current month
    expect(allMonths(S, "2029-12-15").at(-1)).toBe("2029-12-01")
  })

  it("counts a month as due only after its 10th", () => {
    expect(monthsDue("2026-10-01", S)).toEqual([])
    expect(monthsDue("2026-10-10", S)).toEqual([]) // due date is the 10th itself → not yet overdue
    expect(monthsDue("2026-10-11", S)).toEqual(["2026-10-01"])
    expect(monthsDue("2027-01-11", S)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"])
    expect(monthsDue("2026-09-30", S)).toEqual([])
  })
})

describe("member dues", () => {
  it("multiplies shares by price", () => {
    const h = shares([2, "2026-10-01"])
    expect(expectedForMember(h, "2026-12-11", S)).toBe(3 * 1000)
  })

  it("handles a share change mid-term without changing old dues", () => {
    const h = shares([3, "2026-10-01"], [5, "2027-01-01"])
    expect(sharesForMonth(h, "2026-12-01")).toBe(3)
    expect(sharesForMonth(h, "2027-01-01")).toBe(5)
    // Oct, Nov, Dec at 1500 + Jan, Feb at 2500
    expect(expectedForMember(h, "2027-02-11", S)).toBe(3 * 1500 + 2 * 2500)
  })

  it("uses the latest row when shares change twice for the same month", () => {
    const h = shares([2, "2026-10-01"], [4, "2026-11-01"], [3, "2026-11-01"])
    expect(sharesForMonth(h, "2026-11-01")).toBe(3)
  })

  it("charges a late joiner arrears from the start month", () => {
    // Joined Jan 2027; share history recorded from the join month.
    const h = shares([2, "2027-01-01"])
    expect(sharesForMonth(h, "2026-10-01")).toBe(2)
    expect(expectedForMember(h, "2027-01-15", S)).toBe(4 * 1000) // Oct, Nov, Dec, Jan
    expect(dueForMember(h, [pay("2027-01-01", 1000)], "2027-01-15", S)).toBe(3000)
  })

  it("adds partial payments across two rows for the same month", () => {
    const h = shares([3, "2026-10-01"])
    const p = [pay("2026-10-01", 1000), pay("2026-10-01", 500)]
    const lines = memberMonths(h, p, "2026-11-11", S)
    expect(lines[0]).toMatchObject({ month: "2026-10-01", expected: 1500, paid: 1500, status: "paid", remaining: 0 })
    expect(lines[1]).toMatchObject({ month: "2026-11-01", status: "unpaid", remaining: 1500 })
    const onlyFirst = memberMonths(h, p.slice(0, 1), "2026-11-11", S)
    expect(onlyFirst[0]).toMatchObject({ status: "partial", remaining: 500 })
  })

  it("excludes voided rows everywhere", () => {
    const h = shares([1, "2026-10-01"])
    const p = [pay("2026-10-01", 500, "void"), pay("2026-11-01", 500)]
    expect(paidForMember(p)).toBe(500)
    expect(dueForMember(h, p, "2026-11-11", S)).toBe(500)
    const lines = memberMonths(h, p, "2026-11-11", S)
    expect(lines[0].status).toBe("unpaid")
    expect(lines[1].status).toBe("paid")
  })

  it("never reports negative due when paid in advance", () => {
    const h = shares([1, "2026-10-01"])
    const p = [pay("2026-10-01", 500), pay("2026-11-01", 500), pay("2026-12-01", 500)]
    expect(dueForMember(h, p, "2026-10-15", S)).toBe(0)
    const lines = memberMonths(h, p, "2026-10-15", S)
    expect(lines[1].status).toBe("paid") // advance payment
    expect(lines[3].status).toBe("not_yet_due")
  })

  it("finds the oldest unpaid month and the overdue list", () => {
    const h = shares([2, "2026-10-01"])
    const p = [pay("2026-10-01", 1000), pay("2026-11-01", 400)]
    const lines = memberMonths(h, p, "2027-01-05", S)
    expect(oldestUnpaidMonth(lines)).toMatchObject({ month: "2026-11-01", remaining: 600 })
    expect(overdueMonths(lines).map((l) => l.month)).toEqual(["2026-11-01", "2026-12-01"])
  })

  it("counts trailing missed months for the 3-month notice", () => {
    const h = shares([1, "2026-10-01"])
    const lines = memberMonths(h, [pay("2026-10-01", 500)], "2027-01-11", S)
    expect(trailingMissedMonths(lines)).toBe(3) // Nov, Dec, Jan
    const lines2 = memberMonths(h, [pay("2027-01-01", 500)], "2027-01-11", S)
    expect(trailingMissedMonths(lines2)).toBe(0)
  })
})

describe("fund", () => {
  it("computes cash, invested and the 30% minimum", () => {
    const f = fundSummary(100_000, [
      { type: "expense", amount: 2_000, status: "valid" },
      { type: "investment", amount: 60_000, status: "valid" },
      { type: "investment_return", amount: 10_000, status: "valid" },
      { type: "bank_profit", amount: 500, status: "valid" },
      { type: "business_income", amount: 1_500, status: "valid" },
      { type: "expense", amount: 9_999, status: "void" },
    ])
    expect(f.cash).toBe(100_000 + 1_500 + 10_000 + 500 - 2_000 - 60_000) // 50,000
    expect(f.invested).toBe(50_000)
    expect(f.total).toBe(100_000)
    expect(f.cashPct).toBe(50)
    expect(f.cashBelowMinimum).toBe(false)
  })

  it("warns when cash drops below 30%", () => {
    const f = fundSummary(100_000, [{ type: "investment", amount: 75_000, status: "valid" }])
    expect(f.cashPct).toBe(25)
    expect(f.minCashPct).toBe(30)
    expect(f.cashBelowMinimum).toBe(true)
  })

  it("handles an empty fund", () => {
    const f = fundSummary(0, [])
    expect(f).toMatchObject({ cash: 0, invested: 0, cashPct: 100, cashBelowMinimum: false })
  })
})

describe("due reminder", () => {
  const h = shares([2, "2026-10-01"])
  it("counts the days left until the 10th", () => {
    const lines = memberMonths(h, [], "2026-10-04", S)
    expect(dueReminder(lines, "2026-10-04", 10)).toEqual({ month: "2026-10-01", remaining: 1000, dueDate: "2026-10-10", daysLeft: 6 })
    expect(dueReminder(memberMonths(h, [], "2026-10-10", S), "2026-10-10", 10)?.daysLeft).toBe(0)
  })
  it("shows only what is still unpaid, and nothing once paid or overdue", () => {
    expect(dueReminder(memberMonths(h, [pay("2026-10-01", 400)], "2026-10-04", S), "2026-10-04", 10)?.remaining).toBe(600)
    expect(dueReminder(memberMonths(h, [pay("2026-10-01", 1000)], "2026-10-04", S), "2026-10-04", 10)).toBeNull()
    expect(dueReminder(memberMonths(h, [], "2026-10-11", S), "2026-10-11", 10)).toBeNull()
  })
})

describe("payment allocation", () => {
  const open = [
    { month: "2026-10-01", remaining: 500 }, // half paid already
    { month: "2026-11-01", remaining: 1000 },
    { month: "2026-12-01", remaining: 1000 },
  ]
  it("fills the oldest months first, then a partial month", async () => {
    const { allocatePayment } = await import("@/lib/ledger")
    expect(allocatePayment(open, 2000)).toEqual({
      items: [
        { forMonth: "2026-10-01", amount: 500, full: true },
        { forMonth: "2026-11-01", amount: 1000, full: true },
        { forMonth: "2026-12-01", amount: 500, full: false },
      ],
      leftover: 0,
    })
  })
  it("reports what doesn't fit, and handles zero", async () => {
    const { allocatePayment } = await import("@/lib/ledger")
    expect(allocatePayment(open, 3000).leftover).toBe(500)
    expect(allocatePayment(open, 0)).toEqual({ items: [], leftover: 0 })
  })
})
