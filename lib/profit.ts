// Year-end profit distribution (constitution, spec §1). Pure functions, unit-tested.
//
// profit       = business income + bank profit − expenses, dated inside the period
//                (investment_return is principal coming back, not profit — see DECISIONS.md)
// reserve      = reserve_pct (50%) of profit, plus any taka left over from rounding
// distributed  = the rest, split by share ratio among members active at calculation time.
//                Share ratio uses share-months (Σ shares held in each month of the period),
//                so a member who changed shares mid-year is weighted fairly.

import { addMonths, monthDiff, sharesForMonth, type ShareRow, type TxnRow } from "@/lib/ledger"

export type ProfitMember = {
  id: number
  memberNo: number
  name: string
  active: boolean
  history: ShareRow[]
}

export type ProfitLine = { memberId: number; memberNo: number; name: string; shareMonths: number; amount: number }

export type ProfitResult = {
  periodStart: string // first month "YYYY-MM-01"
  periodEnd: string // last month "YYYY-MM-01" (inclusive)
  income: number
  expense: number
  profit: number
  reservePct: number
  reserveAmount: number
  distributedAmount: number
  roundingToReserve: number
  totalShareMonths: number
  lines: ProfitLine[]
}

export type DatedTxn = TxnRow & { date: string }

/** The n-th samiti year (0-based) starting at start_month, e.g. Oct 2026 – Sep 2027. */
export function samitiYear(startMonth: string, index: number): { periodStart: string; periodEnd: string } {
  const periodStart = addMonths(startMonth, index * 12)
  return { periodStart, periodEnd: addMonths(periodStart, 11) }
}

export function computeDistribution(input: {
  periodStart: string
  periodEnd: string
  txns: DatedTxn[]
  members: ProfitMember[]
  reservePct: number
}): ProfitResult {
  const { periodStart, periodEnd, reservePct } = input
  const lastDay = addMonths(periodEnd, 1) // exclusive upper bound
  const inPeriod = input.txns.filter((t) => t.status === "valid" && t.date >= periodStart && t.date < lastDay)
  const sum = (types: string[]) => inPeriod.filter((t) => types.includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const income = sum(["business_income", "bank_profit"])
  const expense = sum(["expense"])
  const profit = income - expense

  const months = Array.from({ length: monthDiff(periodStart, periodEnd) + 1 }, (_, i) => addMonths(periodStart, i))
  const eligible = input.members
    .filter((m) => m.active)
    .map((m) => ({ m, shareMonths: months.reduce((s, mo) => s + sharesForMonth(m.history, mo), 0) }))
    .filter((e) => e.shareMonths > 0)
  const totalShareMonths = eligible.reduce((s, e) => s + e.shareMonths, 0)

  if (profit <= 0 || totalShareMonths === 0) {
    return {
      periodStart,
      periodEnd,
      income,
      expense,
      profit,
      reservePct,
      reserveAmount: Math.max(0, profit),
      distributedAmount: 0,
      roundingToReserve: 0,
      totalShareMonths,
      lines: eligible.map(({ m, shareMonths }) => ({ memberId: m.id, memberNo: m.memberNo, name: m.name, shareMonths, amount: 0 })),
    }
  }

  const distributable = Math.floor((profit * (100 - reservePct)) / 100)
  const lines = eligible.map(({ m, shareMonths }) => ({
    memberId: m.id,
    memberNo: m.memberNo,
    name: m.name,
    shareMonths,
    amount: Math.floor((distributable * shareMonths) / totalShareMonths),
  }))
  const distributedAmount = lines.reduce((s, l) => s + l.amount, 0)
  const roundingToReserve = distributable - distributedAmount
  return {
    periodStart,
    periodEnd,
    income,
    expense,
    profit,
    reservePct,
    reserveAmount: profit - distributedAmount,
    distributedAmount,
    roundingToReserve,
    totalShareMonths,
    lines,
  }
}

/** Cash share (%) after spending `amount` on a new investment — for the 70/30 warning. */
export function cashPctAfterInvestment(cash: number, invested: number, amount: number): number {
  const total = cash + invested // an investment moves money from cash to invested; total is unchanged
  if (total <= 0) return 0
  return Math.floor((Math.max(0, cash - amount) * 100) / total)
}
