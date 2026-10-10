import { desc, eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, paymentDateFixes, paymentReceivers, payments, settings, type Payment } from "@/lib/db/schema"
import { monthLabel, todayDhaka } from "@/lib/format"
import { allMonths } from "@/lib/ledger"
import { writeAudit } from "@/lib/audit"
import { enqueueSheet } from "@/lib/outbox"
import { UserError } from "./errors"

export type RecordPaymentsInput = {
  memberId: number
  items: { forMonth: string; amount: number }[]
  paidOn: string
  method: Payment["method"]
  trxId: string | null
  note: string | null
  clientRef: string | null
  /** The admin who actually holds the money (defaults to whoever enters the record). */
  receivedBy?: number
}

/**
 * One payment row per month, all in one transaction. If the same clientRef was
 * already saved (double tap / retry on a slow connection), the existing rows are
 * returned instead of creating duplicates.
 */
export async function recordPayments(db: DB, actorId: number, input: RecordPaymentsInput, today = todayDhaka()): Promise<Payment[]> {
  if (input.items.length === 0) throw new UserError("অন্তত একটি মাস বাছাই করুন।")
  const months = new Set(input.items.map((i) => i.forMonth))
  if (months.size !== input.items.length) throw new UserError("একই মাস দুইবার বাছাই করা হয়েছে।")
  for (const it of input.items) {
    if (!Number.isInteger(it.amount) || it.amount <= 0) throw new UserError("টাকার পরিমাণ সঠিক নয়।")
    if (!/^\d{4}-\d{2}-01$/.test(it.forMonth)) throw new UserError("মাস সঠিক নয়।")
  }

  if (input.paidOn > today) throw new UserError("জমার তারিখ ভবিষ্যতের হতে পারে না।")
  // Only months the ledger knows about: start_month … end of term (or the current month if later).
  const [s] = await db.select().from(settings).limit(1)
  const known = allMonths({ sharePrice: s.sharePrice, startMonth: s.startMonth, dueDay: s.dueDay, termMonths: s.termMonths }, today)
  for (const it of input.items) {
    if (it.forMonth < known[0] || it.forMonth > known[known.length - 1]) {
      throw new UserError(`${monthLabel(it.forMonth)} সমিতির মেয়াদের বাইরে।`)
    }
  }

  if (input.clientRef) {
    // A retry of the same save returns the original receipts — but only if it is exactly the
    // same request (member, months, amounts). Anything else is an error, never someone else's receipt.
    const existing = await db.select().from(payments).where(eq(payments.clientRef, input.clientRef))
    if (existing.length > 0) {
      const key = (rows: { forMonth: string; amount: number }[]) =>
        rows.map((r) => `${r.forMonth}:${r.amount}`).sort().join("|")
      const same = existing.every((p) => p.memberId === input.memberId) && key(existing) === key(input.items)
      if (!same) throw new UserError("আগের সংরক্ষণের সাথে মিলছে না। পাতাটি আবার খুলে চেষ্টা করুন।")
      return existing.sort((a, b) => a.receiptNo - b.receiptNo)
    }
  }

  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(members).where(eq(members.id, input.memberId))
    if (!member) throw new UserError("সদস্য পাওয়া যায়নি।")
    if (member.status !== "active") throw new UserError("বাতিল সদস্যের জমা নেওয়া যাবে না।")
    const receiverId = input.receivedBy ?? actorId
    if (receiverId !== actorId) {
      const [receiver] = await tx.select().from(members).where(eq(members.id, receiverId))
      if (!receiver || receiver.status !== "active" || receiver.role !== "admin") {
        throw new UserError("টাকা গ্রহণকারী একজন সক্রিয় অ্যাডমিন হতে হবে।")
      }
    }
    const rows = await tx
      .insert(payments)
      .values(
        input.items.map((it) => ({
          memberId: input.memberId,
          forMonth: it.forMonth,
          amount: it.amount,
          paidOn: input.paidOn,
          method: input.method,
          trxId: input.trxId,
          note: input.note,
          receivedBy: receiverId,
          clientRef: input.clientRef,
        })),
      )
      .returning()
    for (const row of rows) {
      await writeAudit(tx, { actorId, action: "payment_create", table: "payments", rowId: row.id, after: row })
      await enqueueSheet(tx, "payment", row.id)
    }
    return rows.sort((a, b) => a.receiptNo - b.receiptNo)
  })
}

/**
 * Corrects who holds the money for existing (valid) payments. The payment row itself stays frozen;
 * the correction is appended to payment_receivers (insert-only) and audited.
 */
export async function changeReceiver(db: DB, actorId: number, paymentIds: number[], receiverId: number): Promise<number> {
  const ids = [...new Set(paymentIds)]
  if (ids.length === 0) throw new UserError("অন্তত একটি জমা বাছাই করুন।")
  if (ids.length > 500) throw new UserError("একসাথে অনেক বেশি জমা বাছাই করা হয়েছে।")
  return db.transaction(async (tx) => {
    const [receiver] = await tx.select().from(members).where(eq(members.id, receiverId))
    if (!receiver || receiver.status !== "active" || receiver.role !== "admin") {
      throw new UserError("টাকা গ্রহণকারী একজন সক্রিয় অ্যাডমিন হতে হবে।")
    }
    let changed = 0
    for (const id of ids) {
      const [pay] = await tx.select().from(payments).where(eq(payments.id, id))
      if (!pay) throw new UserError("জমা পাওয়া যায়নি।")
      if (pay.status !== "valid") throw new UserError("বাতিল জমার গ্রহণকারী বদলানো যায় না।")
      const [last] = await tx.select().from(paymentReceivers).where(eq(paymentReceivers.paymentId, id)).orderBy(desc(paymentReceivers.id)).limit(1)
      const current = last?.receiverId ?? pay.receivedBy
      if (current === receiverId) continue
      await tx.insert(paymentReceivers).values({ paymentId: id, receiverId, setBy: actorId })
      await writeAudit(tx, {
        actorId,
        action: "payment_receiver_change",
        table: "payments",
        rowId: id,
        before: { receivedBy: current },
        after: { receivedBy: receiverId },
      })
      await enqueueSheet(tx, "payment", id)
      changed++
    }
    return changed
  })
}

/**
 * Corrects the date a payment was received (e.g. money collected before the samiti's first day is
 * dated that first day). The payment row stays frozen; the correction is appended to
 * payment_date_fixes (insert-only) and audited. The receipt number and amount never change.
 */
export async function fixPaymentDates(db: DB, actorId: number, paymentIds: number[], paidOn: string, today = todayDhaka()): Promise<number> {
  const ids = [...new Set(paymentIds)]
  if (ids.length === 0) throw new UserError("অন্তত একটি জমা বাছাই করুন।")
  if (ids.length > 500) throw new UserError("একসাথে অনেক বেশি জমা বাছাই করা হয়েছে।")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw new UserError("তারিখ সঠিক নয়।")
  if (paidOn > today) throw new UserError("জমার তারিখ ভবিষ্যতের হতে পারে না।")
  return db.transaction(async (tx) => {
    let changed = 0
    for (const id of ids) {
      const [pay] = await tx.select().from(payments).where(eq(payments.id, id))
      if (!pay) throw new UserError("জমা পাওয়া যায়নি।")
      if (pay.status !== "valid") throw new UserError("বাতিল জমার তারিখ বদলানো যায় না।")
      const [last] = await tx.select().from(paymentDateFixes).where(eq(paymentDateFixes.paymentId, id)).orderBy(desc(paymentDateFixes.id)).limit(1)
      const current = last?.paidOn ?? pay.paidOn
      if (current === paidOn) continue
      await tx.insert(paymentDateFixes).values({ paymentId: id, paidOn, setBy: actorId })
      await writeAudit(tx, { actorId, action: "payment_date_fix", table: "payments", rowId: id, before: { paidOn: current }, after: { paidOn } })
      await enqueueSheet(tx, "payment", id)
      changed++
    }
    return changed
  })
}
