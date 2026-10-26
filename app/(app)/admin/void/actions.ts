"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { voidHandover } from "@/lib/services/handovers"
import { voidPayment, voidTransaction } from "@/lib/services/void"
import { formObject, idParam, reqText } from "@/lib/validation"

const schema = z.object({
  kind: z.enum(["payment", "transaction", "handover"]),
  id: idParam,
  reason: reqText(500, "বাতিলের কারণ লিখুন।"),
})

export async function voidAction(_: ActionResult<null> | undefined, fd: FormData) {
  return adminAction(async (admin) => {
    const { kind, id, reason } = schema.parse(formObject(fd))
    if (kind === "payment") await voidPayment(getDb(), admin.id, id, reason)
    else if (kind === "handover") await voidHandover(getDb(), admin.id, id, reason)
    else await voidTransaction(getDb(), admin.id, id, reason)
    revalidatePath("/", "layout")
    return null
  })
}
