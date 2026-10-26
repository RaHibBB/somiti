"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { closeMonth, reopenMonth, setTask, TASK_KEYS } from "@/lib/services/month-close"
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

export async function toggleTaskAction(input: { month: string; key: string; done: boolean }) {
  return adminAction<null>(async (admin) => {
    const { month, key, done } = z.object({ month: monthKey, key: z.enum(TASK_KEYS), done: z.boolean() }).parse(input)
    await setTask(getDb(), admin.id, month, key, done)
    refresh()
    return null
  })
}
