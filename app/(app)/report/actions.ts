"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { UserError } from "@/lib/services/errors"
import { submitReport } from "@/lib/services/payment-reports"
import { firstError, isoDate, monthKey, optText } from "@/lib/validation"

const schema = z.object({
  items: z
    .array(z.object({ forMonth: monthKey, amount: z.number().int().positive("টাকার পরিমাণ সঠিক নয়।").max(1_000_000) }))
    .min(1, "অন্তত একটি মাস বাছাই করুন।")
    .max(36),
  method: z.enum(["bkash", "nagad", "rocket", "bank"]),
  trxId: z.string().trim().min(4, "ট্রানজেকশন আইডি লিখুন (বিকাশ/নগদের মেসেজে থাকে)।").max(40),
  paidOn: isoDate,
  note: optText(300),
})

export type ReportState = { ok: true } | { ok: false; error: string }

export async function submitReportAction(input: z.input<typeof schema>): Promise<ReportState> {
  const me = await requireMember()
  try {
    await submitReport(getDb(), me, schema.parse(input))
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message }
    if (err instanceof z.ZodError) return { ok: false, error: firstError(err) }
    console.error(err)
    return { ok: false, error: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।" }
  }
  revalidatePath("/", "layout")
  return { ok: true }
}
