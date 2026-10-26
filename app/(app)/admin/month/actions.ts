"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { closeMonth, reopenMonth } from "@/lib/services/month-close"
import { monthKey } from "@/lib/validation"

const refresh = () => revalidatePath("/", "layout")

export async function closeMonthAction(input: { month: string }) {
  return adminAction<null>(async (admin) => {
    await closeMonth(getDb(), admin.id, monthKey.parse(input.month))
    refresh()
    return null
  })
}

export async function reopenMonthAction(input: { month: string; reason: string }) {
  return adminAction<null>(async (admin) => {
    const { month, reason } = z.object({ month: monthKey, reason: z.string().max(500) }).parse(input)
    await reopenMonth(getDb(), admin.id, month, reason)
    refresh()
    return null
  })
}
