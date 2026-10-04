import { and, eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, profitDistributions, transactions } from "@/lib/db/schema"
import { loadSnapshot, loadTransactions } from "@/lib/data"
import { monthLabel, todayDhaka } from "@/lib/format"
import { enqueueSheet } from "@/lib/outbox"
import { computeDistribution, samitiYear, type ProfitResult } from "@/lib/profit"
import { isUniqueViolation, UserError } from "./errors"

export type DistributionDetails = Pick<
  ProfitResult,
  "income" | "expense" | "reservePct" | "roundingToReserve" | "totalShareMonths" | "lines"
> & { dividendTransactionId: number | null }

/** Calculate (not save) the distribution for the n-th samiti year, from current data. */
export async function previewDistribution(db: DB, yearIndex: number): Promise<ProfitResult> {
  const [snap, txns] = await Promise.all([loadSnapshot(db, todayDhaka()), loadTransactions(db)])
  const { periodStart, periodEnd } = samitiYear(snap.settings.startMonth, yearIndex)
  return computeDistribution({
    periodStart,
    periodEnd,
    reservePct: snap.settings.reservePct,
    txns: txns.map((t) => ({ date: t.date, type: t.type, amount: t.amount, status: t.status })),
    members: snap.members.map((m) => ({
      id: m.member.id,
      memberNo: m.member.memberNo,
      name: m.member.nameBn,
      active: m.member.status === "active",
      history: m.history,
    })),
  })
}

/**
 * Saves the distribution decided for a year (recomputed on the server, never trusted from the form).
 * Optionally records the payout as one `dividend` transaction dated `paidOn`.
 */
export async function saveDistribution(
  db: DB,
  actorId: number,
  yearIndex: number,
  opts: { recordDividend: boolean; paidOn: string },
  today = todayDhaka(),
) {
  if (opts.paidOn > today) throw new UserError("লভ্যাংশের তারিখ ভবিষ্যতের হতে পারে না।")
  const r = await previewDistribution(db, yearIndex)
  if (r.profit <= 0) throw new UserError("এই বছরে কোনো মুনাফা নেই — বণ্টনের কিছু নেই।")
  const label = `${monthLabel(r.periodStart)} – ${monthLabel(r.periodEnd)}`
  try {
    return await insertDistribution(db, actorId, r, label, opts)
  } catch (err) {
    // Two saves at the same moment: the partial unique index lets only one through.
    if (isUniqueViolation(err, "profit_distributions_one_valid_per_year")) {
      throw new UserError("এই বছরের বণ্টন আগেই সংরক্ষণ করা হয়েছে। নতুন করে করতে আগেরটি বাতিল করুন।")
    }
    throw err
  }
}

async function insertDistribution(
  db: DB,
  actorId: number,
  r: ProfitResult,
  label: string,
  opts: { recordDividend: boolean; paidOn: string },
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: profitDistributions.id })
      .from(profitDistributions)
      .where(and(eq(profitDistributions.periodStart, r.periodStart), eq(profitDistributions.status, "valid")))
    if (existing) throw new UserError("এই বছরের বণ্টন আগেই সংরক্ষণ করা হয়েছে। নতুন করে করতে আগেরটি বাতিল করুন।")

    let dividendTransactionId: number | null = null
    if (opts.recordDividend && r.distributedAmount > 0) {
      const [t] = await tx
        .insert(transactions)
        .values({
          date: opts.paidOn,
          type: "dividend",
          description: `লভ্যাংশ বণ্টন ${label}`,
          amount: r.distributedAmount,
          approvedBy: "বার্ষিক মুনাফা বণ্টন",
          createdBy: actorId,
        })
        .returning()
      dividendTransactionId = t.id
      await tx.insert(auditLog).values({ actorId, action: "transaction_create", tableName: "transactions", rowId: String(t.id), after: t })
      await enqueueSheet(tx, "transaction", t.id)
    }

    const details: DistributionDetails = {
      income: r.income,
      expense: r.expense,
      reservePct: r.reservePct,
      roundingToReserve: r.roundingToReserve,
      totalShareMonths: r.totalShareMonths,
      lines: r.lines,
      dividendTransactionId,
    }
    const [row] = await tx
      .insert(profitDistributions)
      .values({
        periodLabel: label,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalProfit: r.profit,
        reserveAmount: r.reserveAmount,
        distributedAmount: r.distributedAmount,
        details,
        createdBy: actorId,
      })
      .returning()
    await tx.insert(auditLog).values({ actorId, action: "profit_distribution_create", tableName: "profit_distributions", rowId: String(row.id), after: row })
    return row
  })
}

/** Void a saved distribution (and the dividend transaction it recorded, if any). */
export async function voidDistribution(db: DB, actorId: number, id: number, reason: string) {
  const voidReason = reason.trim()
  if (voidReason.length < 3) throw new UserError("বাতিলের কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।")
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(profitDistributions).where(eq(profitDistributions.id, id)).for("update")
    if (!before) throw new UserError("বণ্টন পাওয়া যায়নি।")
    if (before.status === "void") throw new UserError("এটি আগেই বাতিল।")
    const now = new Date()
    const [after] = await tx
      .update(profitDistributions)
      .set({ status: "void", voidReason, voidedBy: actorId, voidedAt: now })
      .where(eq(profitDistributions.id, id))
      .returning()
    await tx.insert(auditLog).values({ actorId, action: "profit_distribution_void", tableName: "profit_distributions", rowId: String(id), before, after })
    const txnId = (before.details as DistributionDetails | null)?.dividendTransactionId
    if (txnId) {
      const [t] = await tx.select().from(transactions).where(eq(transactions.id, txnId))
      if (t && t.status === "valid") {
        const [tv] = await tx
          .update(transactions)
          .set({ status: "void", voidReason: `বণ্টন বাতিল: ${voidReason}`, voidedBy: actorId, voidedAt: now })
          .where(eq(transactions.id, txnId))
          .returning()
        await tx.insert(auditLog).values({ actorId, action: "transaction_void", tableName: "transactions", rowId: String(txnId), before: t, after: tv })
        await enqueueSheet(tx, "transaction", txnId)
      }
    }
    return after
  })
}
