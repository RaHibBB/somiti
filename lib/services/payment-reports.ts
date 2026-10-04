import { and, desc, eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members, paymentReports, payments, type Member, type PaymentReport } from "@/lib/db/schema"
import { todayDhaka } from "@/lib/format"
import { isUniqueViolation, UserError } from "./errors"
import { recordPayments } from "./payments"

export type ReportInput = {
  items: { forMonth: string; amount: number }[]
  method: "bkash" | "nagad" | "rocket" | "bank"
  trxId: string
  paidOn: string
  note: string | null
}

/** A member tells the samiti they paid by mobile wallet/bank. Nothing counts until an admin approves. */
export async function submitReport(db: DB, member: Pick<Member, "id" | "status">, input: ReportInput, today = todayDhaka()): Promise<PaymentReport> {
  if (member.status !== "active") throw new UserError("বাতিল সদস্যপদ থেকে জমা জানানো যাবে না।")
  if (input.items.length === 0) throw new UserError("অন্তত একটি মাস বাছাই করুন।")
  if (input.items.some((i) => !Number.isInteger(i.amount) || i.amount <= 0)) throw new UserError("টাকার পরিমাণ সঠিক নয়।")
  if (new Set(input.items.map((i) => i.forMonth)).size !== input.items.length) throw new UserError("একই মাস দুইবার বাছাই করা হয়েছে।")
  const trxId = input.trxId.trim().toUpperCase()
  if (trxId.length < 4) throw new UserError("ট্রানজেকশন আইডি লিখুন (বিকাশ/নগদের মেসেজে থাকে)।")
  if (input.paidOn > today) throw new UserError("তারিখ ভবিষ্যতের হতে পারে না।")
  // Already used on an admin-entered payment?
  const [dupPayment] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.trxId, trxId), eq(payments.status, "valid"))).limit(1)
  if (dupPayment) throw new UserError("এই ট্রানজেকশন আইডি দিয়ে আগেই জমা নেওয়া হয়েছে।")
  try {
    return await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(paymentReports)
        .values({
          memberId: member.id,
          items: input.items,
          amount: input.items.reduce((s, i) => s + i.amount, 0),
          method: input.method,
          trxId,
          paidOn: input.paidOn,
          note: input.note,
        })
        .returning()
      await tx.insert(auditLog).values({ actorId: member.id, action: "report_submit", tableName: "payment_reports", rowId: String(r.id), after: r })
      return r
    })
  } catch (err) {
    if (isUniqueViolation(err, "payment_reports_trx_once")) throw new UserError("এই ট্রানজেকশন আইডি আগেই জানানো হয়েছে।")
    throw err
  }
}

/** Approve: creates the real payment rows (receipts) and closes the report, all in one transaction. */
export async function approveReport(db: DB, adminId: number, reportId: number, today = todayDhaka()) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(paymentReports).where(eq(paymentReports.id, reportId)).for("update")
    if (!r) throw new UserError("রিপোর্ট পাওয়া যায়নি।")
    if (r.status !== "pending") throw new UserError("এই রিপোর্ট আগেই যাচাই করা হয়েছে।")
    const rows = await recordPayments(
      tx as unknown as DB,
      adminId,
      {
        memberId: r.memberId,
        items: r.items,
        paidOn: r.paidOn,
        method: r.method,
        trxId: r.trxId,
        note: r.note ? `সদস্যের জানানো: ${r.note}` : "সদস্যের জানানো জমা",
        clientRef: `report:${r.id}`,
      },
      today,
    )
    const [after] = await tx
      .update(paymentReports)
      .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date(), paymentIds: rows.map((p) => p.id) })
      .where(eq(paymentReports.id, reportId))
      .returning()
    await tx.insert(auditLog).values({ actorId: adminId, action: "report_approve", tableName: "payment_reports", rowId: String(reportId), before: r, after })
    return { report: after, payments: rows }
  })
}

export async function rejectReport(db: DB, adminId: number, reportId: number, reason: string) {
  const why = reason.trim()
  if (why.length < 3) throw new UserError("কেন বাতিল করছেন লিখুন (সদস্য দেখতে পাবেন)।")
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(paymentReports).where(eq(paymentReports.id, reportId)).for("update")
    if (!r) throw new UserError("রিপোর্ট পাওয়া যায়নি।")
    if (r.status !== "pending") throw new UserError("এই রিপোর্ট আগেই যাচাই করা হয়েছে।")
    const [after] = await tx
      .update(paymentReports)
      .set({ status: "rejected", reviewedBy: adminId, reviewedAt: new Date(), rejectReason: why })
      .where(eq(paymentReports.id, reportId))
      .returning()
    await tx.insert(auditLog).values({ actorId: adminId, action: "report_reject", tableName: "payment_reports", rowId: String(reportId), before: r, after })
    return after
  })
}

export async function pendingReports(db: DB) {
  return db
    .select({ r: paymentReports, name: members.nameBn, no: members.memberNo, phone: members.phone })
    .from(paymentReports)
    .innerJoin(members, eq(members.id, paymentReports.memberId))
    .where(eq(paymentReports.status, "pending"))
    .orderBy(paymentReports.createdAt)
}

export async function myReports(db: DB, memberId: number, limit = 10) {
  return db.select().from(paymentReports).where(eq(paymentReports.memberId, memberId)).orderBy(desc(paymentReports.createdAt)).limit(limit)
}
