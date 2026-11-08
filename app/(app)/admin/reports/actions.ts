"use server"

import { revalidatePath } from "next/cache"
import { notifyLater } from "@/lib/notify"
import { paymentNotification } from "@/lib/notify-messages"
import { taka } from "@/lib/format"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { approveReport, rejectReport } from "@/lib/services/payment-reports"
import { formObject, idParam, reqText } from "@/lib/validation"

type State<T> = ActionResult<T> | undefined

export async function approveReportAction(_: State<{ receipts: number[] }>, fd: FormData) {
  return adminAction(async (admin) => {
    const id = idParam.parse(fd.get("id"))
    const { report, payments } = await approveReport(getDb(), admin.id, id)
    notifyLater(async () => [{ ...paymentNotification(report.memberId, payments), kind: "report" as const, title: `আপনার জানানো ${taka(report.amount)} জমা হয়েছে` }])
    revalidatePath("/", "layout")
    return { receipts: payments.map((p) => p.receiptNo) }
  })
}

export async function rejectReportAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { id, reason } = z.object({ id: idParam, reason: reqText(300, "কেন বাতিল করছেন লিখুন।") }).parse(formObject(fd))
    const r = await rejectReport(getDb(), admin.id, id, reason)
    notifyLater(async () => [
      { memberId: r.memberId, kind: "report", title: `আপনার জানানো ${taka(r.amount)} বাতিল হয়েছে`, body: `কারণ: ${r.rejectReason ?? ""}`, url: "/report" },
    ])
    revalidatePath("/", "layout")
    return null
  })
}
