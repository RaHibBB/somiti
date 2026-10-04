"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { saveDistribution, voidDistribution } from "@/lib/services/profit"
import { formObject, idParam, isoDate, reqText } from "@/lib/validation"

type State<T> = ActionResult<T> | undefined

export async function saveDistributionAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { year, recordDividend, paidOn } = z
      .object({
        year: z.coerce.number().int().min(0).max(50),
        recordDividend: z.string().optional().transform((s) => s === "on"),
        paidOn: isoDate,
      })
      .parse(formObject(fd))
    await saveDistribution(getDb(), admin.id, year, { recordDividend, paidOn })
    revalidatePath("/", "layout")
    return null
  })
}

export async function voidDistributionAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { id, reason } = z.object({ id: idParam, reason: reqText(500, "বাতিলের কারণ লিখুন।") }).parse(formObject(fd))
    await voidDistribution(getDb(), admin.id, id, reason)
    revalidatePath("/", "layout")
    return null
  })
}
