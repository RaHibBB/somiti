// Core money calculations. Pure functions: no DB, no clock — callers pass `today`
// (Asia/Dhaka "YYYY-MM-DD", see todayDhaka()). Months are "YYYY-MM-01" strings.
// All amounts are integer taka.

export type LedgerSettings = {
  sharePrice: number
  startMonth: string // "2026-10-01"
  dueDay: number // 10
  termMonths: number // 36
}

export type ShareRow = { shares: number; effectiveMonth: string; id: number }
export type PaymentRow = { forMonth: string; amount: number; status: "valid" | "void" }
export type TxnType =
  | "expense"
  | "investment"
  | "business_income"
  | "investment_return"
  | "bank_profit"
  | "member_refund"
  | "dividend"
export type TxnRow = { type: TxnType; amount: number; status: "valid" | "void" }

export type MonthStatus = "paid" | "partial" | "unpaid" | "not_yet_due"

// ── Month arithmetic ─────────────────────────────────────────────────────────

export function monthOf(date: string): string {
  return date.slice(0, 7) + "-01"
}

export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`
}

export function monthDiff(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
}

export function dueDateOf(month: string, dueDay: number): string {
  return month.slice(0, 8) + String(dueDay).padStart(2, "0")
}

/**
 * Every month to show: from start_month to the end of the term, extended to the
 * current month if the samiti runs past its term. Never hard-coded to 36.
 */
export function allMonths(settings: LedgerSettings, today: string): string[] {
  const termEnd = addMonths(settings.startMonth, settings.termMonths - 1)
  const current = monthOf(today)
  const last = current > termEnd ? current : termEnd
  const count = monthDiff(settings.startMonth, last) + 1
  return Array.from({ length: Math.max(0, count) }, (_, i) => addMonths(settings.startMonth, i))
}

/** Months from start_month whose due date (the 10th) is strictly before today. */
export function monthsDue(today: string, settings: LedgerSettings): string[] {
  const out: string[] = []
  for (let m = settings.startMonth; dueDateOf(m, settings.dueDay) < today; m = addMonths(m, 1)) out.push(m)
  return out
}

// ── Shares ───────────────────────────────────────────────────────────────────

/**
 * Shares held for `month`: the latest share_history row with effective_month <= month
 * (ties broken by id). If the member's first row is later than `month` — e.g. a late
 * joiner whose history starts at their join month — their earliest row applies, because
 * members owe from start_month regardless of join date (arrears rule).
 */
export function sharesForMonth(history: ShareRow[], month: string): number {
  if (history.length === 0) return 0
  let best: ShareRow | null = null
  let earliest: ShareRow = history[0]
  for (const row of history) {
    if (row.effectiveMonth < earliest.effectiveMonth || (row.effectiveMonth === earliest.effectiveMonth && row.id < earliest.id)) {
      earliest = row
    }
    if (row.effectiveMonth <= month) {
      if (!best || row.effectiveMonth > best.effectiveMonth || (row.effectiveMonth === best.effectiveMonth && row.id > best.id)) {
        best = row
      }
    }
  }
  return (best ?? earliest).shares
}

export function expectedForMonth(history: ShareRow[], month: string, settings: LedgerSettings): number {
  return sharesForMonth(history, month) * settings.sharePrice
}

// ── Member totals ────────────────────────────────────────────────────────────

export function expectedForMember(history: ShareRow[], today: string, settings: LedgerSettings): number {
  return monthsDue(today, settings).reduce((sum, m) => sum + expectedForMonth(history, m, settings), 0)
}

export function paidForMember(payments: PaymentRow[]): number {
  return payments.reduce((sum, p) => (p.status === "valid" ? sum + p.amount : sum), 0)
}

export function dueForMember(history: ShareRow[], payments: PaymentRow[], today: string, settings: LedgerSettings): number {
  return Math.max(0, expectedForMember(history, today, settings) - paidForMember(payments))
}

export function paidByMonth(payments: PaymentRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of payments) {
    if (p.status !== "valid") continue
    map.set(p.forMonth, (map.get(p.forMonth) ?? 0) + p.amount)
  }
  return map
}

export type MonthLine = {
  month: string
  expected: number
  paid: number
  remaining: number
  status: MonthStatus
  isDue: boolean // due date has passed
}

/** Per-month breakdown for a member over allMonths(). */
export function memberMonths(
  history: ShareRow[],
  payments: PaymentRow[],
  today: string,
  settings: LedgerSettings,
): MonthLine[] {
  const paid = paidByMonth(payments)
  return allMonths(settings, today).map((month) => {
    const expected = expectedForMonth(history, month, settings)
    const p = paid.get(month) ?? 0
    const isDue = dueDateOf(month, settings.dueDay) < today
    let status: MonthStatus
    if (expected > 0 && p >= expected) status = "paid"
    else if (!isDue) status = p > 0 ? "partial" : "not_yet_due"
    else status = p > 0 ? "partial" : "unpaid"
    return { month, expected, paid: p, remaining: Math.max(0, expected - p), status, isDue }
  })
}

/** Default month for "take payment": the oldest month not fully paid (due or not). */
export function oldestUnpaidMonth(lines: MonthLine[]): MonthLine | null {
  return lines.find((l) => l.remaining > 0) ?? null
}

/** Due months that are not fully paid (for reminders). */
export function overdueMonths(lines: MonthLine[]): MonthLine[] {
  return lines.filter((l) => l.isDue && l.remaining > 0)
}

/**
 * Longest run of consecutive due months that are not fully paid, ending at the most
 * recent due month. 3+ means the member should get a notice (constitution).
 */
export function trailingMissedMonths(lines: MonthLine[]): number {
  const due = lines.filter((l) => l.isDue)
  let n = 0
  for (let i = due.length - 1; i >= 0 && due[i].remaining > 0; i--) n++
  return n
}

// ── Samiti fund ──────────────────────────────────────────────────────────────

export type FundSummary = {
  totalDues: number
  income: number // business_income + investment_return + bank_profit
  outflow: number // expense + investment + member_refund + dividend
  byType: Record<TxnType, number>
  /** Spec §6 "Fund": money on hand (dues + income − outflows). */
  cash: number
  /** investment − investment_return (never negative). */
  invested: number
  /** cash + invested: everything the samiti owns. */
  total: number
  /** cash as % of total (0–100, rounded down); 100 when total is 0. */
  cashPct: number
  minCashPct: number
  cashBelowMinimum: boolean
}

export function fundSummary(validDuesTotal: number, txns: TxnRow[], maxInvestPct = 70): FundSummary {
  const byType: Record<TxnType, number> = {
    expense: 0,
    investment: 0,
    business_income: 0,
    investment_return: 0,
    bank_profit: 0,
    member_refund: 0,
    dividend: 0,
  }
  for (const t of txns) if (t.status === "valid") byType[t.type] += t.amount
  const income = byType.business_income + byType.investment_return + byType.bank_profit
  const outflow = byType.expense + byType.investment + byType.member_refund + byType.dividend
  const cash = validDuesTotal + income - outflow
  const invested = Math.max(0, byType.investment - byType.investment_return)
  const total = cash + invested
  const cashPct = total > 0 ? Math.floor((Math.max(0, cash) * 100) / total) : 100
  const minCashPct = 100 - maxInvestPct
  return {
    totalDues: validDuesTotal,
    income,
    outflow,
    byType,
    cash,
    invested,
    total,
    cashPct,
    minCashPct,
    cashBelowMinimum: total > 0 && cashPct < minCashPct,
  }
}

// ── Member reminder ──────────────────────────────────────────────────────────

export type DueReminder = { month: string; remaining: number; dueDate: string; daysLeft: number }

/**
 * "This month's dues: ৳X by the 10th — N days left": only while the current month still has
 * something to pay and its due date hasn't passed (overdue months are shown as বকেয়া instead).
 */
export function dueReminder(lines: MonthLine[], today: string, dueDay: number): DueReminder | null {
  const line = lines.find((l) => l.month === monthOf(today))
  if (!line || line.remaining <= 0) return null
  const dueDate = dueDateOf(line.month, dueDay)
  if (today > dueDate) return null
  const daysLeft = Math.round((Date.parse(dueDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000)
  return { month: line.month, remaining: line.remaining, dueDate, daysLeft }
}

// ── Payment allocation ───────────────────────────────────────────────────────

export type Allocation = { items: { forMonth: string; amount: number; full: boolean }[]; leftover: number }

/**
 * "He gave ৳X": spread the amount over the open months, oldest first — full months, then a
 * partial last month. Whatever doesn't fit inside the term is returned as `leftover`.
 */
export function allocatePayment(open: { month: string; remaining: number }[], amount: number): Allocation {
  const items: Allocation["items"] = []
  let left = Math.max(0, Math.floor(amount))
  for (const o of open) {
    if (left <= 0) break
    const take = Math.min(left, o.remaining)
    items.push({ forMonth: o.month, amount: take, full: take === o.remaining })
    left -= take
  }
  return { items, leftover: left }
}
