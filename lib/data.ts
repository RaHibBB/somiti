// Read-side queries shared by pages. Small dataset (≤60 members), so we load
// rows once per request and compute balances in memory with lib/ledger.
import { asc, desc, eq } from "drizzle-orm"
import { cache } from "react"
import type { DB } from "@/lib/db"
import { getDb } from "@/lib/db"
import { members, notices, paymentDateFixes, paymentReceivers, payments, settings, shareHistory, transactions, type Member } from "@/lib/db/schema"
import { todayDhaka } from "@/lib/format"
import {
  dueForMember,
  expectedForMember,
  memberMonths,
  paidForMember,
  sharesForMonth,
  monthOf,
  trailingMissedMonths,
  fundSummary,
  type LedgerSettings,
  type MonthLine,
  type ShareRow,
  type PaymentRow,
} from "@/lib/ledger"

export async function loadSettings(db: DB = getDb()) {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  if (!row) throw new Error("settings row missing — run migrations")
  return row
}

export function toLedgerSettings(s: Awaited<ReturnType<typeof loadSettings>>): LedgerSettings {
  return { sharePrice: s.sharePrice, startMonth: s.startMonth, dueDay: s.dueDay, termMonths: s.termMonths }
}

export type MemberLedger = {
  member: Member
  sharesNow: number
  history: ShareRow[]
  payments: (typeof payments.$inferSelect)[]
  lines: MonthLine[]
  expected: number
  paid: number
  due: number
  missedStreak: number
  /** This month's unpaid amount while it is still inside the 1st–10th window (not yet "overdue"). */
  currentOpen: number
}

export type SamitiSnapshot = {
  today: string
  settings: Awaited<ReturnType<typeof loadSettings>>
  ledgerSettings: LedgerSettings
  members: MemberLedger[]
}

/** Every member (active and cancelled) with their computed balances. */
export async function loadSnapshot(db: DB = getDb(), today = todayDhaka()): Promise<SamitiSnapshot> {
  const [s, allMembers, allShares, rawPayments, receiverFixes, dateFixes] = await Promise.all([
    loadSettings(db),
    db.select().from(members).orderBy(asc(members.memberNo)),
    db.select().from(shareHistory).orderBy(asc(shareHistory.id)),
    db.select().from(payments).orderBy(asc(payments.forMonth), asc(payments.receiptNo)),
    db.select().from(paymentReceivers).orderBy(asc(paymentReceivers.id)),
    db.select().from(paymentDateFixes).orderBy(asc(paymentDateFixes.id)),
  ])
  // The latest correction (if any) says who really holds the money for a payment.
  const fixedReceiver = new Map(receiverFixes.map((f) => [f.paymentId, f.receiverId]))
  const fixedDate = new Map(dateFixes.map((f) => [f.paymentId, f.paidOn]))
  const allPayments = rawPayments.map((p) => ({
    ...p,
    receivedBy: fixedReceiver.get(p.id) ?? p.receivedBy,
    paidOn: fixedDate.get(p.id) ?? p.paidOn,
  }))
  const ls = toLedgerSettings(s)
  const sharesBy = groupBy(allShares, (r) => r.memberId)
  const paysBy = groupBy(allPayments, (r) => r.memberId)
  const thisMonth = monthOf(today)
  const list = allMembers.map((member) => {
    const history: ShareRow[] = (sharesBy.get(member.id) ?? []).map((r) => ({
      id: r.id,
      shares: r.shares,
      effectiveMonth: r.effectiveMonth,
    }))
    const pays = paysBy.get(member.id) ?? []
    const prows: PaymentRow[] = pays.map((p) => ({ forMonth: p.forMonth, amount: p.amount, status: p.status }))
    const lines = memberMonths(history, prows, today, ls)
    return {
      member,
      sharesNow: sharesForMonth(history, thisMonth),
      history,
      payments: pays,
      lines,
      expected: expectedForMember(history, today, ls),
      paid: paidForMember(prows),
      due: dueForMember(history, prows, today, ls),
      missedStreak: trailingMissedMonths(lines),
      currentOpen: (() => {
        const l = lines.find((x) => x.month === thisMonth)
        return l && !l.isDue ? l.remaining : 0
      })(),
    }
  })
  return { today, settings: s, ledgerSettings: ls, members: list }
}

export const getSnapshot = cache(() => loadSnapshot())

export async function loadFund(db: DB = getDb()) {
  const [pays, txns, s] = await Promise.all([
    db.select({ amount: payments.amount, status: payments.status }).from(payments),
    db.select({ type: transactions.type, amount: transactions.amount, status: transactions.status }).from(transactions),
    loadSettings(db),
  ])
  const dues = pays.reduce((sum, p) => (p.status === "valid" ? sum + p.amount : sum), 0)
  return fundSummary(dues, txns, s.maxInvestPct)
}

export async function loadLatestNotices(limit = 3, db: DB = getDb()) {
  return db.select().from(notices).where(eq(notices.status, "active")).orderBy(desc(notices.createdAt)).limit(limit)
}

export async function loadTransactions(db: DB = getDb()) {
  return db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id))
}

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = map.get(k)
    if (list) list.push(r)
    else map.set(k, [r])
  }
  return map
}
