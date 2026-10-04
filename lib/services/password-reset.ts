import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { and, count, eq, gt, isNull, sql } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members, passwordResets, type Member } from "@/lib/db/schema"
import { isValidPassword, isWeakPassword, normalizeEmail } from "@/lib/auth/pin"
import { UserError } from "./errors"

export const RESET_TTL_MINUTES = 30
export const MAX_RESETS_PER_HOUR = 3

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

export type ResetRequest = { member: Pick<Member, "id" | "nameBn" | "email">; token: string } | null

/**
 * Creates a one-time reset token for the member with this email, if any.
 * Returns null (silently) for unknown/cancelled emails or when rate-limited, so the
 * caller always shows the same message and can't be used to discover addresses.
 */
export async function createResetToken(db: DB, rawEmail: string, now = new Date()): Promise<ResetRequest> {
  const email = normalizeEmail(rawEmail)
  if (!email) return null
  const [member] = await db.select().from(members).where(eq(members.email, email)).limit(1)
  if (!member || member.status !== "active") return null

  const hourAgo = new Date(now.getTime() - 60 * 60_000)
  const token = randomBytes(32).toString("base64url")
  const issued = await db.transaction(async (tx) => {
    // Lock the member row so parallel requests can't all pass the rate limit.
    await tx.select({ id: members.id }).from(members).where(eq(members.id, member.id)).for("update")
    const [{ n }] = await tx
      .select({ n: count() })
      .from(passwordResets)
      .where(and(eq(passwordResets.memberId, member.id), gt(passwordResets.createdAt, hourAgo)))
    if (n >= MAX_RESETS_PER_HOUR) return false
    await tx.insert(passwordResets).values({
      memberId: member.id,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
    })
    await tx.insert(auditLog).values({ actorId: null, action: "password_reset_requested", tableName: "members", rowId: String(member.id) })
    return true
  })
  if (!issued) return null
  return { member: { id: member.id, nameBn: member.nameBn, email: member.email }, token }
}

/** Is this token currently usable? (For showing the form vs. an "expired" message.) */
export async function checkResetToken(db: DB, token: string, now = new Date()): Promise<boolean> {
  if (!token) return false
  const [row] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
    .limit(1)
  return Boolean(row)
}

/** Sets a new password using a reset token. Single use; logs the member out everywhere. */
export async function resetPasswordWithToken(db: DB, token: string, password: string, now = new Date()): Promise<Member> {
  if (!isValidPassword(password)) throw new UserError("পাসওয়ার্ড ৬ থেকে ৬৪ অক্ষরের হতে হবে।")
  if (isWeakPassword(password)) throw new UserError("এই পাসওয়ার্ড খুব সহজ। অন্য পাসওয়ার্ড দিন।")
  const hash = await bcrypt.hash(password, 10)
  return db.transaction(async (tx) => {
    const [reset] = await tx
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, sha256(token)))
      .for("update")
      .limit(1)
    if (!reset || reset.usedAt || reset.expiresAt <= now) {
      throw new UserError("লিংকটির মেয়াদ শেষ বা আগেই ব্যবহার করা হয়েছে। আবার “পাসওয়ার্ড ভুলে গেছেন” থেকে চেষ্টা করুন।")
    }
    const [member] = await tx
      .update(members)
      .set({
        pinHash: hash,
        mustChangePin: false,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: sql`${members.sessionVersion} + 1`,
      })
      .where(and(eq(members.id, reset.memberId), eq(members.status, "active")))
      .returning()
    if (!member) throw new UserError("এই সদস্যপদ সক্রিয় নয়।")
    // Using one link cancels every other outstanding link for this member.
    await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(and(eq(passwordResets.memberId, reset.memberId), isNull(passwordResets.usedAt)))
    await tx.insert(auditLog).values({ actorId: member.id, action: "password_reset_done", tableName: "members", rowId: String(member.id) })
    return member
  })
}
