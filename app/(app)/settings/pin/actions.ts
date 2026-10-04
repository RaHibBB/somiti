"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireMember } from "@/lib/auth/session"
import { normalizeEmail } from "@/lib/auth/pin"
import { writeAudit } from "@/lib/audit"
import { getDb } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { enqueueSheet } from "@/lib/outbox"
import { isUniqueViolation } from "@/lib/services/errors"

type State = { ok: true } | { ok: false; error: string } | undefined

/** Members may set or clear their own email (used for login and password reset). */
export async function updateMyEmailAction(_: State, fd: FormData): Promise<State> {
  const me = await requireMember({ allowPinChange: true })
  const raw = String(fd.get("email") ?? "").trim()
  const email = raw ? normalizeEmail(raw) : null
  if (raw && !email) return { ok: false, error: "ইমেইল ঠিকানা সঠিক নয়।" }
  try {
    await getDb().transaction(async (tx) => {
      await tx.update(members).set({ email }).where(eq(members.id, me.id))
      await writeAudit(tx, { actorId: me.id, action: "email_change", table: "members", rowId: me.id, before: { email: me.email }, after: { email } })
      await enqueueSheet(tx, "member", me.id)
    })
  } catch (err) {
    if (isUniqueViolation(err, "members_email_unique")) return { ok: false, error: "এই ইমেইল অন্য সদস্যের অ্যাকাউন্টে আছে।" }
    throw err
  }
  revalidatePath("/settings/pin")
  return { ok: true }
}
