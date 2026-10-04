// Login throttling, done atomically in the database so parallel requests can't bypass it.
//
// Each attempt first *reserves* a slot with one UPDATE (before the slow bcrypt check):
//   - if the account is locked, no row comes back → refuse;
//   - an expired lock is cleared and the counter restarts at 1;
//   - the attempt that brings the counter to MAX sets the lock immediately, so no more
//     than MAX passwords can ever be tried per lock window, however many arrive at once.
// A correct password then clears the counter and the lock.
import { and, eq, isNull, lte, or, sql } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { LOCK_MINUTES, MAX_FAILED_LOGINS } from "./pin"

export type Reservation = { allowed: true; attempt: number; lockedNow: boolean } | { allowed: false; lockedUntil: Date | null }

export async function reserveLoginAttempt(db: DB, memberId: number, now = new Date()): Promise<Reservation> {
  const nowIso = now.toISOString()
  const lockIso = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString()
  const expired = sql`(${members.lockedUntil} IS NOT NULL AND ${members.lockedUntil} <= ${nowIso}::timestamptz)`
  const next = sql`(CASE WHEN ${expired} THEN 1 ELSE ${members.failedLogins} + 1 END)`
  const rows = await db
    .update(members)
    .set({
      failedLogins: next,
      lockedUntil: sql`CASE WHEN ${next} >= ${MAX_FAILED_LOGINS} THEN ${lockIso}::timestamptz WHEN ${expired} THEN NULL ELSE ${members.lockedUntil} END`,
    })
    .where(and(eq(members.id, memberId), or(isNull(members.lockedUntil), lte(members.lockedUntil, now))))
    .returning({ attempt: members.failedLogins, lockedUntil: members.lockedUntil })
  if (rows.length === 0) {
    const [m] = await db.select({ lockedUntil: members.lockedUntil }).from(members).where(eq(members.id, memberId))
    return { allowed: false, lockedUntil: m?.lockedUntil ?? null }
  }
  return { allowed: true, attempt: rows[0].attempt, lockedNow: rows[0].lockedUntil !== null }
}

/** After a correct password: reset the counter and lift any lock set by this attempt. */
export async function clearLoginAttempts(db: DB, memberId: number) {
  await db.update(members).set({ failedLogins: 0, lockedUntil: null }).where(eq(members.id, memberId))
}

/** After a wrong password on the attempt that set the lock: the counter restarts when the lock ends. */
export async function finishLock(db: DB, memberId: number) {
  await db.update(members).set({ failedLogins: 0 }).where(eq(members.id, memberId))
}
