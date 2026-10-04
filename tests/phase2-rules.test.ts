import { describe, expect, it } from "vitest"
import { tally, quorumFor } from "@/lib/voting"
import { cashPctAfterInvestment, computeDistribution, samitiYear, type DatedTxn, type ProfitMember } from "@/lib/profit"

describe("voting rules", () => {
  it("needs more than 50% of active members", () => {
    expect(quorumFor(32)).toBe(17)
    expect(quorumFor(31)).toBe(16)
    expect(tally(10, 6, 32)).toMatchObject({ voted: 16, quorumMet: false, outcome: "invalid" }) // exactly 50% is not enough
    expect(tally(10, 7, 32)).toMatchObject({ voted: 17, quorumMet: true, outcome: "passed" })
  })
  it("Yes must beat No; a tie rejects", () => {
    expect(tally(9, 9, 32).outcome).toBe("rejected")
    expect(tally(8, 10, 32).outcome).toBe("rejected")
    expect(tally(10, 8, 32).outcome).toBe("passed")
  })
  it("one-member samiti edge cases", () => {
    expect(tally(0, 0, 0).outcome).toBe("invalid")
    expect(tally(1, 0, 1).outcome).toBe("passed")
  })
})

const hist = (...rows: [number, string][]) => rows.map(([shares, effectiveMonth], i) => ({ id: i + 1, shares, effectiveMonth }))
const txn = (date: string, type: DatedTxn["type"], amount: number, status: "valid" | "void" = "valid"): DatedTxn => ({
  date,
  type,
  amount,
  status,
})

describe("profit distribution", () => {
  const year = samitiYear("2026-10-01", 0)
  const members: ProfitMember[] = [
    { id: 1, memberNo: 1, name: "এক", active: true, history: hist([1, "2026-10-01"]) },
    { id: 2, memberNo: 2, name: "দুই", active: true, history: hist([2, "2026-10-01"]) },
    { id: 3, memberNo: 3, name: "তিন", active: false, history: hist([5, "2026-10-01"]) }, // cancelled: not paid out
  ]

  it("uses the samiti year Oct–Sep", () => {
    expect(year).toEqual({ periodStart: "2026-10-01", periodEnd: "2027-09-01" })
    expect(samitiYear("2026-10-01", 1).periodStart).toBe("2027-10-01")
  })

  it("puts 50% in reserve and splits the rest by share ratio", () => {
    const r = computeDistribution({
      ...year,
      reservePct: 50,
      members,
      txns: [
        txn("2026-11-05", "business_income", 10_000),
        txn("2027-03-01", "bank_profit", 1_000),
        txn("2027-01-10", "expense", 2_000),
        txn("2027-01-11", "expense", 5_000, "void"), // voided: ignored
        txn("2027-02-01", "investment_return", 50_000), // principal, not profit
        txn("2027-10-01", "business_income", 99_999), // next year: ignored
      ],
    })
    expect(r.profit).toBe(9_000)
    expect(r.lines.map((l) => [l.memberId, l.shareMonths, l.amount])).toEqual([
      [1, 12, 1_500],
      [2, 24, 3_000],
    ])
    expect(r.distributedAmount).toBe(4_500)
    expect(r.reserveAmount).toBe(4_500)
  })

  it("weights mid-year share changes by share-months and sends rounding to reserve", () => {
    const r = computeDistribution({
      ...year,
      reservePct: 50,
      members: [
        { id: 1, memberNo: 1, name: "এক", active: true, history: hist([1, "2026-10-01"], [3, "2027-04-01"]) }, // 6×1 + 6×3 = 24
        { id: 2, memberNo: 2, name: "দুই", active: true, history: hist([1, "2026-10-01"]) }, // 12
      ],
      txns: [txn("2027-05-01", "business_income", 1_001)],
    })
    expect(r.lines.map((l) => l.shareMonths)).toEqual([24, 12])
    // distributable = floor(1001 / 2) = 500 → 333.33 and 166.66 → 333 + 166 = 499, 1 taka rounding
    expect(r.lines.map((l) => l.amount)).toEqual([333, 166])
    expect(r.roundingToReserve).toBe(1)
    expect(r.reserveAmount + r.distributedAmount).toBe(1_001)
  })

  it("distributes nothing when there is a loss", () => {
    const r = computeDistribution({ ...year, reservePct: 50, members, txns: [txn("2027-01-01", "expense", 500)] })
    expect(r.profit).toBe(-500)
    expect(r.distributedAmount).toBe(0)
    expect(r.reserveAmount).toBe(0)
  })
})

describe("70/30 rule", () => {
  it("projects cash % after a new investment", () => {
    expect(cashPctAfterInvestment(100_000, 0, 70_000)).toBe(30)
    expect(cashPctAfterInvestment(100_000, 0, 70_001)).toBe(29)
    expect(cashPctAfterInvestment(50_000, 50_000, 30_000)).toBe(20)
  })
})
