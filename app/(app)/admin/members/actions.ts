"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { cancelMember, changeShares, createMember, resetPin, updateMember } from "@/lib/services/members"
import { formObject, idParam, intIn, isoDate, monthKey, optEmail, optPhone, optText, reqText } from "@/lib/validation"
import { isValidPassword } from "@/lib/auth/pin"

const memberFields = z.object({
  memberNo: intIn(1, 9999, "সদস্য নম্বর সঠিক নয়।"),
  nameBn: reqText(120, "নাম লিখুন।"),
  phone: optPhone,
  email: optEmail,
  role: z.enum(["member", "admin"]),
  joinedOn: isoDate,
  nomineeName: optText(120),
  nomineePhone: optPhone,
  notes: optText(1000),
})

const createSchema = memberFields.extend({
  shares: intIn(1, 999, "শেয়ার সংখ্যা সঠিক নয় (কমপক্ষে ১)।"),
  shareStartMonth: monthKey,
  pin: z
    .string()
    .optional()
    .transform((s) => (s ? s.trim() : undefined))
    .refine((s) => s === undefined || isValidPassword(s), "পাসওয়ার্ড ৬ থেকে ৬৪ অক্ষরের হতে হবে।"),
})

type State<T> = ActionResult<T> | undefined

function refresh() {
  revalidatePath("/", "layout")
}

export async function createMemberAction(_: State<{ id: number; pin: string; name: string }>, fd: FormData) {
  return adminAction(async (admin) => {
    const input = createSchema.parse(formObject(fd))
    const { member, pin } = await createMember(getDb(), admin.id, input)
    refresh()
    return { id: member.id, pin, name: member.nameBn }
  })
}

export async function updateMemberAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const obj = formObject(fd)
    const id = idParam.parse(obj.id)
    await updateMember(getDb(), admin.id, id, memberFields.parse(obj))
    refresh()
    return null
  })
}

export async function changeSharesAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const obj = formObject(fd)
    const { id, shares, effectiveMonth } = z
      .object({ id: idParam, shares: intIn(1, 999, "শেয়ার সংখ্যা সঠিক নয় (কমপক্ষে ১)।"), effectiveMonth: monthKey })
      .parse(obj)
    await changeShares(getDb(), admin.id, id, shares, effectiveMonth)
    refresh()
    return null
  })
}

export async function resetPinAction(_: State<{ pin: string }>, fd: FormData) {
  return adminAction(async (admin) => {
    const id = idParam.parse(fd.get("id"))
    const { pin } = await resetPin(getDb(), admin.id, id)
    return { pin }
  })
}

export async function cancelMemberAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const obj = formObject(fd)
    const { id, reason } = z.object({ id: idParam, reason: reqText(500, "বাতিলের কারণ লিখুন।") }).parse(obj)
    await cancelMember(getDb(), admin.id, id, reason)
    refresh()
    return null
  })
}
