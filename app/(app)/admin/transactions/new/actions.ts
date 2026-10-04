"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { uploadReceipt } from "@/lib/blob"
import { getDb } from "@/lib/db"
import { loadFund } from "@/lib/data"
import { cashPctAfterInvestment } from "@/lib/profit"
import { UserError } from "@/lib/services/errors"
import { createTransaction } from "@/lib/services/transactions"
import { formObject, isoDate, optIsoDate, optText, reqText, takaAmount } from "@/lib/validation"
import { toBn } from "@/lib/format"

const schema = z.object({
  date: isoDate,
  type: z.enum(["expense", "investment", "business_income", "investment_return", "bank_profit", "member_refund", "dividend"]),
  description: reqText(500, "বিবরণ লিখুন।"),
  amount: takaAmount,
  approvedBy: optText(200),
  meetingDate: optIsoDate,
  voteResult: optText(200),
  proposalId: z
    .string()
    .optional()
    .transform((s) => (s ? Number(s) : null))
    .pipe(z.number().int().positive().nullable()),
  acceptRuleBreak: z
    .string()
    .optional()
    .transform((s) => s === "on"),
})

export async function createTransactionAction(_: ActionResult<{ id: number }> | undefined, fd: FormData) {
  return adminAction(async (admin) => {
    const { acceptRuleBreak, ...input } = schema.parse(formObject(fd))
    // 70/30 rule: warn, and require an explicit acknowledgement to go below the cash minimum.
    if (input.type === "investment") {
      const fund = await loadFund()
      const after = cashPctAfterInvestment(fund.cash, fund.invested, input.amount)
      if ((after < fund.minCashPct || input.amount > fund.cash) && !acceptRuleBreak) {
        throw new UserError(`এই বিনিয়োগের পর নগদ থাকবে ${toBn(after)}% — নিয়মের (${toBn(fund.minCashPct)}%) নিচে। জেনে-বুঝে করতে হলে "৭০/৩০ নিয়মের বাইরে গেলেও…" ঘরে টিক দিন।`)
      }
    }
    const photo = fd.get("photo")
    const receiptUrl = photo instanceof File && photo.size > 0 ? await uploadReceipt(photo) : null
    const row = await createTransaction(getDb(), admin.id, { ...input, receiptUrl })
    revalidatePath("/", "layout")
    return { id: row.id }
  })
}
