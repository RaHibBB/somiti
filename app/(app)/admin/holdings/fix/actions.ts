"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { changeReceiver } from "@/lib/services/payments"

const schema = z.object({
  paymentIds: z.array(z.number().int().positive()).min(1, "অন্তত একটি জমা বাছাই করুন।").max(500),
  receiverId: z.number().int().positive(),
})

export async function changeReceiverAction(input: z.input<typeof schema>) {
  return adminAction<{ changed: number }>(async (admin) => {
    const data = schema.parse(input)
    const changed = await changeReceiver(getDb(), admin.id, data.paymentIds, data.receiverId)
    revalidatePath("/", "layout")
    return { changed }
  })
}
