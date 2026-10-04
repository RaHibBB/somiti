"use server"

import bcrypt from "bcryptjs"
import { eq, sql } from "drizzle-orm"
import { after } from "next/server"
import { redirect } from "next/navigation"
import { z } from "zod"
import { appUrl } from "@/lib/app-url"
import { writeAudit } from "@/lib/audit"
import { getDb } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { toBn } from "@/lib/format"
import { sendMail } from "@/lib/mail"
import { UserError } from "@/lib/services/errors"
import { createResetToken, RESET_TTL_MINUTES, resetPasswordWithToken } from "@/lib/services/password-reset"
import { clearLoginAttempts, finishLock, reserveLoginAttempt } from "./attempts"
import { isValidPassword, isWeakPassword, LOCK_MINUTES, parseIdentifier, PASSWORD_MAX } from "./pin"
import { clearSessionCookie, requireMember, setSessionCookie } from "./session"

export type FormState = { error?: string; ok?: boolean; identifier?: string } | undefined

const BAD_LOGIN = "ইমেইল/মোবাইল/সদস্য নম্বর অথবা পাসওয়ার্ড ভুল।"
const DUMMY_HASH = "$2b$10$qTATgbV45yUmIABTM4QOGeEtr1v1LQIrI7Jx3sgqTkuyBUoSfWv0y"

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const typed = String(formData.get("identifier") ?? "").slice(0, 254)
  const fail = (error: string): FormState => ({ error, identifier: typed })
  const parsed = z
    .object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(PASSWORD_MAX) })
    .safeParse({ identifier: formData.get("identifier"), password: formData.get("password") })
  if (!parsed.success) return fail("ইমেইল/মোবাইল/সদস্য নম্বর এবং পাসওয়ার্ড দিন।")
  const ident = parseIdentifier(parsed.data.identifier)
  if (!ident) return fail("ইমেইল, মোবাইল নম্বর (০১XXXXXXXXX) বা সদস্য নম্বর সঠিকভাবে লিখুন।")
  const { password } = parsed.data

  const db = getDb()
  const where =
    ident.kind === "email"
      ? eq(members.email, ident.email)
      : ident.kind === "phone"
        ? eq(members.phone, ident.phone)
        : eq(members.memberNo, ident.memberNo)
  const [member] = await db.select().from(members).where(where).limit(1)
  if (!member || !member.pinHash) {
    // Spend similar time as a real check so timing doesn't reveal which accounts exist.
    await bcrypt.compare(password, DUMMY_HASH)
    return fail(BAD_LOGIN)
  }
  if (member.status !== "active") return fail("এই সদস্যপদ বাতিল করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।")

  const lockedMsg = (until: Date | null) => {
    const mins = until ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000)) : LOCK_MINUTES
    return fail(`বারবার ভুল পাসওয়ার্ডের কারণে অ্যাকাউন্ট সাময়িক বন্ধ। ${toBn(mins)} মিনিট পরে চেষ্টা করুন।`)
  }
  // Reserve this attempt atomically before the (slow) password check — see lib/auth/attempts.ts.
  const slot = await reserveLoginAttempt(db, member.id)
  if (!slot.allowed) return lockedMsg(slot.lockedUntil)

  if (!(await bcrypt.compare(password, member.pinHash))) {
    if (slot.lockedNow) {
      await finishLock(db, member.id)
      await db.transaction(async (tx) => {
        await writeAudit(tx, { actorId: null, action: "login_locked", table: "members", rowId: member.id })
      })
      return fail(`৫ বার ভুল পাসওয়ার্ড। ${toBn(LOCK_MINUTES)} মিনিটের জন্য অ্যাকাউন্ট বন্ধ।`)
    }
    return fail(BAD_LOGIN)
  }

  await clearLoginAttempts(db, member.id)
  await setSessionCookie(member)
  redirect(member.mustChangePin ? "/settings/pin" : "/")
}

export async function logoutAction() {
  await clearSessionCookie()
  redirect("/login")
}

function checkNewPassword(next: string, confirm: string): string | null {
  if (!isValidPassword(next)) return "পাসওয়ার্ড ৬ থেকে ৬৪ অক্ষরের হতে হবে।"
  if (next !== confirm) return "নতুন পাসওয়ার্ড দুইবার একই হয়নি।"
  if (isWeakPassword(next)) return "এই পাসওয়ার্ড খুব সহজ (যেমন ১২৩৪৫৬ বা password)। অন্য পাসওয়ার্ড দিন।"
  return null
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMember({ allowPinChange: true })
  const current = String(formData.get("current") ?? "")
  const next = String(formData.get("next") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (!current || !next || !confirm) return { error: "সব ঘর পূরণ করুন।" }
  const problem = checkNewPassword(next, confirm)
  if (problem) return { error: problem }
  if (!me.pinHash || !(await bcrypt.compare(current, me.pinHash))) return { error: "বর্তমান পাসওয়ার্ড ভুল।" }
  if (current === next) return { error: "নতুন পাসওয়ার্ড আগেরটির থেকে আলাদা হতে হবে।" }

  const pinHash = await bcrypt.hash(next, 10)
  const [updated] = await getDb().transaction(async (tx) => {
    const rows = await tx
      .update(members)
      .set({ pinHash, mustChangePin: false, sessionVersion: sql`${members.sessionVersion} + 1` })
      .where(eq(members.id, me.id))
      .returning()
    await writeAudit(tx, { actorId: me.id, action: "pin_change", table: "members", rowId: me.id })
    return rows
  })
  // Other devices are logged out (session_version bumped); keep this one signed in.
  await setSessionCookie(updated)
  return { ok: true }
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim()
  if (!email.includes("@")) return { error: "আপনার ইমেইল ঠিকানা লিখুন।", identifier: email }
  const base = await appUrl()
  // Look up the account and send the email after the response, so the answer and the response
  // time are identical whether or not the address exists. Failures are only logged.
  after(async () => {
    try {
      const req = await createResetToken(getDb(), email)
      if (!req?.member.email) return
      const link = `${base}/reset-password?token=${req.token}`
      await sendMail({
        to: req.member.email,
        subject: "পাসওয়ার্ড রিসেট — পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি",
        text: [
          `আসসালামু আলাইকুম, ${req.member.nameBn}।`,
          "",
          "নতুন পাসওয়ার্ড দিতে নিচের লিংকে যান:",
          link,
          "",
          `লিংকটি ${toBn(RESET_TTL_MINUTES)} মিনিট কাজ করবে এবং একবারই ব্যবহার করা যাবে।`,
          "আপনি অনুরোধ না করে থাকলে এই ইমেইল উপেক্ষা করুন — আপনার পাসওয়ার্ড বদলাবে না।",
        ].join("\n"),
      })
    } catch (err) {
      console.error("password reset email failed", err)
    }
  })
  // Same answer whether or not the address exists.
  return { ok: true }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "")
  const next = String(formData.get("next") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  const problem = checkNewPassword(next, confirm)
  if (problem) return { error: problem }
  try {
    const member = await resetPasswordWithToken(getDb(), token, next)
    await setSessionCookie(member)
  } catch (err) {
    if (err instanceof UserError) return { error: err.message }
    throw err
  }
  redirect("/")
}
