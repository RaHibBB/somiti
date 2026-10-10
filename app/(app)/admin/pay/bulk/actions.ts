"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { loadSnapshot } from "@/lib/data"
import { UserError } from "@/lib/services/errors"
import { recordPayments } from "@/lib/services/payments"
import { isoDate, monthKey } from "@/lib/validation"

const schema = z.object({
  forMonth: monthKey,
  memberIds: z.array(z.number().int().positive()).min(1, "অন্তত একজন সদস্য বাছাই করুন।").max(200),
  paidOn: isoDate,
  method: z.enum(["cash", "bkash", "nagad", "rocket", "bank"]),
  // One random id per batch; each member's payment gets `${batchRef}:${memberId}`, so retrying the
  // same batch never records anyone twice.
  batchRef: z.string().uuid(),
  receivedBy: z.number().int().positive().optional(),
})

export type BulkResult = {
  saved: { memberId: number; name: string; phone: string | null; receiptNo: number; amount: number; dueAfter: number }[]
  skipped: { memberId: number; name: string; reason: string }[]
}

/**
 * Records the full remaining amount for one month for many members at once (e.g. cash collected
 * at the monthly meeting). The amount is always recomputed on the server from the ledger.
 */
export async function bulkPayAction(input: z.input<typeof schema>) {
  return adminAction<BulkResult>(async (admin) => {
    const data = schema.parse(input)
    const db = getDb()
    const snap = await loadSnapshot(db)
    const result: BulkResult = { saved: [], skipped: [] }
    for (const memberId of [...new Set(data.memberIds)]) {
      const entry = snap.members.find((m) => m.member.id === memberId)
      if (!entry) continue
      const name = entry.member.nameBn
      const line = entry.lines.find((l) => l.month === data.forMonth)
      // Retrying a batch: the first run already filled this month, so look for that receipt.
      const clientRef = `${data.batchRef}:${memberId}`
      const earlier = entry.payments.find((p) => p.clientRef === clientRef && p.status === "valid")
      if (earlier) {
        result.saved.push({ memberId, name, phone: entry.member.phone, receiptNo: earlier.receiptNo, amount: earlier.amount, dueAfter: entry.due })
        continue
      }
      if (!line || line.remaining <= 0) {
        result.skipped.push({ memberId, name, reason: "এই মাস আগেই পরিশোধিত" })
        continue
      }
      try {
        const [p] = await recordPayments(db, admin.id, {
          memberId,
          items: [{ forMonth: data.forMonth, amount: line.remaining }],
          paidOn: data.paidOn,
          method: data.method,
          trxId: null,
          note: "একসাথে জমা",
          clientRef,
          receivedBy: data.receivedBy,
        })
        result.saved.push({ memberId, name, phone: entry.member.phone, receiptNo: p.receiptNo, amount: p.amount, dueAfter: Math.max(0, entry.due - p.amount) })
      } catch (err) {
        if (err instanceof UserError) result.skipped.push({ memberId, name, reason: err.message })
        else throw err
      }
    }
    revalidatePath("/", "layout")
    return result
  })
}
