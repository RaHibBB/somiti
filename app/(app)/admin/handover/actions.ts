"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { createHandover } from "@/lib/services/handovers"
import { isoDate, optText } from "@/lib/validation"

const schema = z.object({
  fromId: z.number().int().positive(),
  toId: z.number().int().positive().nullable(),
  amount: z.number().int().positive("টাকার পরিমাণ শূন্যের বেশি হতে হবে।").max(10_000_000),
  date: isoDate,
  note: optText(300),
})

export async function createHandoverAction(input: z.input<typeof schema>) {
  return adminAction<null>(async (admin) => {
    const data = schema.parse(input)
    await createHandover(getDb(), admin.id, data)
    revalidatePath("/", "layout")
    return null
  })
}
