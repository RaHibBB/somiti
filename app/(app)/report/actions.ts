"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { UserError } from "@/lib/services/errors"
import { submitReport } from "@/lib/services/payment-reports"
import { adminIds, notifyLater } from "@/lib/notify"
import { taka, toBn } from "@/lib/format"
import { firstError, isoDate, monthKey, optText } from "@/lib/validation"

const schema = z.object({
  items: z
    .array(z.object({ forMonth: monthKey, amount: z.number().int().positive("টাকার পরিমাণ সঠিক নয়।").max(1_000_000) }))
    .min(1, "অন্তত একটি মাস বাছাই করুন।")
    .max(36),
  method: z.enum(["bkash", "nagad", "rocket", "bank"]),
  trxId: z.string().trim().min(4, "ট্রানজেকশন / রেফারেন্স নম্বর লিখুন (বিকাশের মেসেজে বা ব্যাংকের স্লিপে থাকে)।").max(40),
  paidOn: isoDate,
  note: optText(300),
})

export type ReportState = { ok: true } | { ok: false; error: string }

export async function submitReportAction(input: z.input<typeof schema>): Promise<ReportState> {
  const me = await requireMember()
  try {
    const r = await submitReport(getDb(), me, schema.parse(input))
    notifyLater(async (db) =>
      (await adminIds(db)).map((id) => ({
        memberId: id,
        kind: "admin" as const,
        title: `${me.nameBn} ${taka(r.amount)} জমা জানিয়েছেন`,
        body: `সদস্য নং ${toBn(me.memberNo)} · ট্রানজেকশন ${r.trxId}। মিলিয়ে দেখে অনুমোদন দিন।`,
        url: "/admin/reports",
      })),
    )
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message }
    if (err instanceof z.ZodError) return { ok: false, error: firstError(err) }
    console.error(err)
    return { ok: false, error: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।" }
  }
  revalidatePath("/", "layout")
  return { ok: true }
}
