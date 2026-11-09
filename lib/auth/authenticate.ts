import "server-only"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, type Member } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { toBn } from "@/lib/format"
import { clearLoginAttempts, finishLock, reserveLoginAttempt, undoReservation } from "./attempts"
import { LOCK_MINUTES, type parseIdentifier } from "./pin"

export const BAD_LOGIN = "ইমেইল/মোবাইল/সদস্য নম্বর অথবা পাসওয়ার্ড ভুল।"
const DUMMY_HASH = "$2b$10$qTATgbV45yUmIABTM4QOGeEtr1v1LQIrI7Jx3sgqTkuyBUoSfWv0y"
/** A family rarely shares one number among more than a few members; cap the work per login. */
const MAX_SHARED = 10

type Ident = NonNullable<ReturnType<typeof parseIdentifier>>
export type AuthResult = { ok: true; member: Member } | { ok: false; error: string }

function lockedMsg(until: Date | null): string {
  const mins = until ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000)) : LOCK_MINUTES
  return `বারবার ভুল পাসওয়ার্ডের কারণে অ্যাকাউন্ট সাময়িক বন্ধ। ${toBn(mins)} মিনিট পরে চেষ্টা করুন।`
}

/**
 * Who is logging in. Email and member number are unique. A mobile number may be shared by
 * several members (a family): then the password decides — each member has their own.
 *
 * Throttling (lib/auth/attempts.ts) still applies per member: an attempt is reserved on every
 * member with that number before the slow password check. If one of them matches, the
 * reservations made on the others are undone (they were not their failures); if none match,
 * it counts as a failed attempt for each.
 */
export async function authenticate(db: DB, ident: Ident, password: string): Promise<AuthResult> {
  const where =
    ident.kind === "email" ? eq(members.email, ident.email) : ident.kind === "phone" ? eq(members.phone, ident.phone) : eq(members.memberNo, ident.memberNo)
  const found = await db.select().from(members).where(where).limit(MAX_SHARED)
  const candidates = found.filter((m) => m.status === "active" && m.pinHash)
  if (candidates.length === 0) {
    // Spend similar time as a real check so timing doesn't reveal which accounts exist.
    await bcrypt.compare(password, DUMMY_HASH)
    if (found.length > 0 && found.every((m) => m.status !== "active")) return { ok: false, error: "এই সদস্যপদ বাতিল করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।" }
    return { ok: false, error: BAD_LOGIN }
  }

  // Reserve an attempt on each (atomic, before bcrypt). Locked accounts are skipped.
  const tried: { member: Member; lockedNow: boolean }[] = []
  let firstLockedUntil: Date | null = null
  for (const m of candidates) {
    const slot = await reserveLoginAttempt(db, m.id)
    if (slot.allowed) tried.push({ member: m, lockedNow: slot.lockedNow })
    else firstLockedUntil ??= slot.lockedUntil
  }
  if (tried.length === 0) return { ok: false, error: lockedMsg(firstLockedUntil) }

  const matches: Member[] = []
  for (const t of tried) if (await bcrypt.compare(password, t.member.pinHash!)) matches.push(t.member)

  if (matches.length === 1) {
    // The right person logged in: their counter is cleared, the others just get their attempt back.
    for (const t of tried) {
      if (t.member.id === matches[0].id) await clearLoginAttempts(db, t.member.id)
      else await undoReservation(db, t.member.id, t.lockedNow)
    }
    return { ok: true, member: matches[0] }
  }
  if (matches.length > 1) {
    for (const t of tried) await undoReservation(db, t.member.id, t.lockedNow)
    return { ok: false, error: "এই মোবাইল নম্বরে একাধিক সদস্য একই পাসওয়ার্ড ব্যবহার করছেন। সদস্য নম্বর দিয়ে লগইন করুন, আর পাসওয়ার্ড আলাদা করে নিন।" }
  }

  // Wrong for everyone: a failed attempt on each; finish any lock this attempt set.
  let justLocked = false
  for (const t of tried) {
    if (!t.lockedNow) continue
    justLocked = true
    await finishLock(db, t.member.id)
    await db.transaction(async (tx) => {
      await writeAudit(tx, { actorId: null, action: "login_locked", table: "members", rowId: t.member.id })
    })
  }
  if (justLocked && tried.every((t) => t.lockedNow)) return { ok: false, error: `৫ বার ভুল পাসওয়ার্ড। ${toBn(LOCK_MINUTES)} মিনিটের জন্য অ্যাকাউন্ট বন্ধ।` }
  return { ok: false, error: BAD_LOGIN }
}
