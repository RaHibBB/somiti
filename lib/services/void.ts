import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { payments, transactions } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { enqueueSheet } from "@/lib/outbox"
import { UserError } from "./errors"

function checkReason(reason: string) {
  const r = reason.trim()
  if (r.length < 3) throw new UserError("বাতিলের কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।")
  return r
}

export async function voidPayment(db: DB, actorId: number, paymentId: number, reason: string) {
  const voidReason = checkReason(reason)
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update")
    if (!before) throw new UserError("জমা পাওয়া যায়নি।")
    if (before.status === "void") throw new UserError("এই জমা আগেই বাতিল করা হয়েছে।")
    const [after] = await tx
      .update(payments)
      .set({ status: "void", voidReason, voidedBy: actorId, voidedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning()
    await writeAudit(tx, { actorId, action: "payment_void", table: "payments", rowId: paymentId, before, after })
    await enqueueSheet(tx, "payment", paymentId)
    return after
  })
}

export async function voidTransaction(db: DB, actorId: number, txnId: number, reason: string) {
  const voidReason = checkReason(reason)
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(transactions).where(eq(transactions.id, txnId)).for("update")
    if (!before) throw new UserError("লেনদেন পাওয়া যায়নি।")
    if (before.status === "void") throw new UserError("এই লেনদেন আগেই বাতিল করা হয়েছে।")
    const [after] = await tx
      .update(transactions)
      .set({ status: "void", voidReason, voidedBy: actorId, voidedAt: new Date() })
      .where(eq(transactions.id, txnId))
      .returning()
    await writeAudit(tx, { actorId, action: "transaction_void", table: "transactions", rowId: txnId, before, after })
    await enqueueSheet(tx, "transaction", txnId)
    return after
  })
}
