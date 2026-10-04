"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { approveReport, rejectReport } from "@/lib/services/payment-reports"
import { formObject, idParam, reqText } from "@/lib/validation"

type State<T> = ActionResult<T> | undefined

export async function approveReportAction(_: State<{ receipts: number[] }>, fd: FormData) {
  return adminAction(async (admin) => {
    const id = idParam.parse(fd.get("id"))
    const { payments } = await approveReport(getDb(), admin.id, id)
    revalidatePath("/", "layout")
    return { receipts: payments.map((p) => p.receiptNo) }
  })
}

export async function rejectReportAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { id, reason } = z.object({ id: idParam, reason: reqText(300, "কেন বাতিল করছেন লিখুন।") }).parse(formObject(fd))
    await rejectReport(getDb(), admin.id, id, reason)
    revalidatePath("/", "layout")
    return null
  })
}
