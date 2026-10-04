"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { loadSnapshot } from "@/lib/data"
import { recordPayments } from "@/lib/services/payments"
import { isoDate, monthKey, optText } from "@/lib/validation"

const schema = z.object({
  memberId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        forMonth: monthKey,
        amount: z.number().int().positive("টাকার পরিমাণ শূন্যের বেশি হতে হবে।").max(1_000_000),
      }),
    )
    .min(1, "অন্তত একটি মাস বাছাই করুন।")
    .max(60),
  paidOn: isoDate,
  method: z.enum(["cash", "bkash", "nagad", "rocket", "bank"]),
  trxId: optText(60),
  note: optText(300),
  clientRef: z.string().uuid().nullable(),
})

export type TakePaymentResult = {
  receipts: { id: number; receiptNo: number; forMonth: string; amount: number }[]
  paidOn: string
  dueAfter: number
}

export async function takePaymentAction(input: z.input<typeof schema>) {
  return adminAction<TakePaymentResult>(async (admin) => {
    const data = schema.parse(input)
    const db = getDb()
    const rows = await recordPayments(db, admin.id, data)
    const snap = await loadSnapshot(db)
    const dueAfter = snap.members.find((m) => m.member.id === data.memberId)?.due ?? 0
    revalidatePath("/", "layout")
    return {
      receipts: rows.map((r) => ({ id: r.id, receiptNo: r.receiptNo, forMonth: r.forMonth, amount: r.amount })),
      paidOn: data.paidOn,
      dueAfter,
    }
  })
}
