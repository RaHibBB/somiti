import { asc } from "drizzle-orm"
import type { DB, Tx } from "@/lib/db"
import { monthCloseEvents } from "@/lib/db/schema"
import { loadSnapshot } from "@/lib/data"
import { writeAudit } from "@/lib/audit"
import { monthLabel, todayDhaka } from "@/lib/format"
import { monthOf } from "@/lib/ledger"
import { UserError } from "./errors"

export type CloseSnapshot = {
  expected: number
  paid: number
  paidCount: number
  activeCount: number
  dueTotal: number
  receivedTotal: number
  holders: { id: number; name: string; amount: number }[]
}

/** First day of the month a YYYY-MM-DD date falls in. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** Months currently closed (the latest event of a month decides). */
export async function closedMonths(db: DB | Tx): Promise<Set<string>> {
  const events = await db.select().from(monthCloseEvents).orderBy(asc(monthCloseEvents.id))
  const state = new Map<string, boolean>()
  for (const e of events) state.set(e.month, e.kind === "close")
  return new Set([...state].filter(([, closed]) => closed).map(([m]) => m))
}

/** Refuses a change dated inside a closed month. */
export async function assertMonthOpen(db: DB | Tx, date: string) {
  const m = monthStart(date)
  if ((await closedMonths(db)).has(m)) {
    throw new UserError(`${monthLabel(m)} মাসের হিসাব বন্ধ করা আছে। বদলাতে হলে আগে "মাস খুলুন" (কারণ লিখে) চাপুন।`)
  }
}

export async function closeMonth(db: DB, actorId: number, month: string, today = todayDhaka()): Promise<void> {
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new UserError("মাস সঠিক নয়।")
  if (month > monthOf(today)) throw new UserError("চলতি মাসের আগে ভবিষ্যতের মাস বন্ধ করা যায় না।")
  if ((await closedMonths(db)).has(month)) throw new UserError("এই মাস আগেই বন্ধ করা আছে।")
  const snap = await loadSnapshot(db, today)
  const active = snap.members.filter((m) => m.member.status === "active")
  const lines = active.map((m) => m.lines.find((l) => l.month === month)).filter((l) => l !== undefined)
  const inMonth = snap.members.flatMap((m) => m.payments).filter((p) => p.status === "valid" && monthStart(p.paidOn) === month)
  const byHolder = new Map<number, number>()
  for (const p of inMonth) if (p.receivedBy) byHolder.set(p.receivedBy, (byHolder.get(p.receivedBy) ?? 0) + p.amount)
  const name = (id: number) => snap.members.find((m) => m.member.id === id)?.member.nameBn ?? "অজানা"
  const snapshot: CloseSnapshot = {
    expected: lines.reduce((s, l) => s + l.expected, 0),
    paid: lines.reduce((s, l) => s + Math.min(l.paid, l.expected), 0),
    paidCount: lines.filter((l) => l.status === "paid").length,
    activeCount: active.length,
    dueTotal: active.reduce((s, m) => s + m.due, 0),
    receivedTotal: inMonth.reduce((s, p) => s + p.amount, 0),
    holders: [...byHolder].map(([id, amount]) => ({ id, name: name(id), amount })),
  }
  await db.transaction(async (tx) => {
    await tx.insert(monthCloseEvents).values({ month, kind: "close", snapshot, byId: actorId })
    await writeAudit(tx, { actorId, action: "month_close", table: "month_close_events", rowId: month, after: snapshot })
  })
}

export async function reopenMonth(db: DB, actorId: number, month: string, reason: string): Promise<void> {
  const r = reason.trim()
  if (r.length < 3) throw new UserError("মাস খোলার কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।")
  if (!(await closedMonths(db)).has(month)) throw new UserError("এই মাস বন্ধ নেই।")
  await db.transaction(async (tx) => {
    await tx.insert(monthCloseEvents).values({ month, kind: "reopen", reason: r, byId: actorId })
    await writeAudit(tx, { actorId, action: "month_reopen", table: "month_close_events", rowId: month, after: { reason: r } })
  })
}
