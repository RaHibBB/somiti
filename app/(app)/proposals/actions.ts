"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { UserError } from "@/lib/services/errors"
import { castVote, closeProposal, createProposal } from "@/lib/services/proposals"
import { formObject, idParam, isoDate, reqText, takaAmount } from "@/lib/validation"

type State<T> = ActionResult<T> | undefined

/** Any active member (including admins) votes once. */
export async function voteAction(_: State<null>, fd: FormData): Promise<State<null>> {
  const me = await requireMember()
  try {
    const { id, choice } = z.object({ id: idParam, choice: z.enum(["yes", "no"]) }).parse(formObject(fd))
    await castVote(getDb(), me, id, choice)
    revalidatePath("/proposals", "layout")
    revalidatePath("/")
    return { ok: true, data: null }
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message }
    throw err
  }
}

const proposalSchema = z.object({
  title: reqText(200, "শিরোনাম লিখুন।"),
  description: reqText(4000, "বিবরণ লিখুন।"),
  amount: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() ? s : undefined))
    .pipe(takaAmount.optional()),
  closesOn: isoDate,
})

export async function createProposalAction(_: State<{ id: number }>, fd: FormData) {
  return adminAction(async (admin) => {
    const input = proposalSchema.parse(formObject(fd))
    // Voting closes at the end of the chosen day in Bangladesh time.
    const closesAt = new Date(`${input.closesOn}T23:59:59+06:00`)
    const p = await createProposal(getDb(), admin.id, {
      title: input.title,
      description: input.description,
      amount: input.amount ?? null,
      closesAt,
    })
    revalidatePath("/", "layout")
    return { id: p.id }
  })
}

export async function closeProposalAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const id = idParam.parse(fd.get("id"))
    await closeProposal(getDb(), admin.id, id)
    revalidatePath("/", "layout")
    return null
  })
}
