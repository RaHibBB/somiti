import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { proposals, transactions, type Transaction } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { enqueueSheet } from "@/lib/outbox"
import { todayDhaka } from "@/lib/format"
import { UserError } from "./errors"

export type TransactionInput = {
  date: string
  type: Transaction["type"]
  description: string
  amount: number
  approvedBy: string | null
  receiptUrl: string | null
  meetingDate: string | null
  voteResult: string | null
  proposalId?: number | null
}

export async function createTransaction(db: DB, actorId: number, input: TransactionInput, today = todayDhaka()): Promise<Transaction> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new UserError("টাকার পরিমাণ সঠিক নয়।")
  if (!input.description.trim()) throw new UserError("বিবরণ লিখুন।")
  if (input.date > today) throw new UserError("তারিখ ভবিষ্যতের হতে পারে না।")
  if (input.proposalId) {
    const [p] = await db.select().from(proposals).where(eq(proposals.id, input.proposalId))
    if (!p) throw new UserError("প্রস্তাব পাওয়া যায়নি।")
    if (p.status !== "passed") throw new UserError("শুধু পাস হওয়া প্রস্তাবের সাথে লেনদেন যুক্ত করা যায়।")
    // Record the vote that authorised it, unless the admin typed something else.
    if (!input.voteResult) input = { ...input, voteResult: `হ্যাঁ ${p.yesCount ?? 0}, না ${p.noCount ?? 0} (প্রস্তাব #${p.id})` }
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({ ...input, description: input.description.trim(), createdBy: actorId })
      .returning()
    await writeAudit(tx, { actorId, action: "transaction_create", table: "transactions", rowId: row.id, after: row })
    await enqueueSheet(tx, "transaction", row.id)
    return row
  })
}
