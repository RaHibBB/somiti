"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { closeProject, createProject, reopenProject } from "@/lib/services/projects"
import { formObject, isoDate, optText, reqText } from "@/lib/validation"
import { fromBn } from "@/lib/format"

const refresh = () => revalidatePath("/", "layout")

const optAmount = z
  .string()
  .optional()
  .transform((s) => {
    const clean = fromBn(s ?? "").replace(/[,\s৳]/g, "")
    return clean ? Number(clean) : null
  })
  .pipe(z.number().int("বাজেট পূর্ণ টাকায় লিখুন।").positive("বাজেট সঠিক নয়।").max(100_000_000).nullable())

const optId = z
  .string()
  .optional()
  .transform((s) => (s ? Number(s) : null))
  .pipe(z.number().int().positive().nullable())

const createSchema = z.object({
  name: reqText(120, "প্রকল্পের নাম লিখুন।"),
  description: optText(1000),
  startedOn: isoDate,
  proposalId: optId,
  budget: optAmount,
})

export async function createProjectAction(_: ActionResult<{ id: number }> | undefined, fd: FormData) {
  return adminAction(async (admin) => {
    const input = createSchema.parse(formObject(fd))
    const p = await createProject(getDb(), admin.id, input)
    refresh()
    return { id: p.id }
  })
}

export async function closeProjectAction(input: { id: number; closedOn: string; note: string }) {
  return adminAction<null>(async (admin) => {
    const { id, closedOn, note } = z.object({ id: z.number().int().positive(), closedOn: isoDate, note: z.string().max(500) }).parse(input)
    await closeProject(getDb(), admin.id, id, closedOn, note || null)
    refresh()
    return null
  })
}

export async function reopenProjectAction(input: { id: number; reason: string }) {
  return adminAction<null>(async (admin) => {
    const { id, reason } = z.object({ id: z.number().int().positive(), reason: z.string().max(500) }).parse(input)
    await reopenProject(getDb(), admin.id, id, reason)
    refresh()
    return null
  })
}
