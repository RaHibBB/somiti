import bcrypt from "bcryptjs"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members } from "@/lib/db/schema"
import { generatePin } from "@/lib/auth/pin"
import { UserError } from "./errors"

export type InviteCandidate = { id: number; no: number; name: string; phone: string | null }
export type Invite = InviteCandidate & { pin: string }

/** Active members who have not chosen their own password yet (they still need first-login details). */
export async function listInviteCandidates(db: DB): Promise<InviteCandidate[]> {
  const rows = await db
    .select({ id: members.id, no: members.memberNo, name: members.nameBn, phone: members.phone })
    .from(members)
    .where(and(eq(members.status, "active"), eq(members.mustChangePin, true)))
    .orderBy(asc(members.memberNo))
  return rows
}

/**
 * New temporary password for each selected member who still hasn't set their own (anyone who has
 * is skipped — their password is never touched). Plaintext passwords exist only in the return
 * value, for the admin to send; the database keeps hashes, the audit log never sees them.
 * Previously issued temporary passwords for these members stop working.
 */
export async function createInvites(db: DB, actorId: number, memberIds: number[]): Promise<{ invites: Invite[]; skipped: number }> {
  const ids = [...new Set(memberIds)]
  if (ids.length === 0) throw new UserError("অন্তত একজন সদস্য বাছাই করুন।")
  if (ids.length > 200) throw new UserError("একবারে সর্বোচ্চ ২০০ জন।")

  const eligible = await db
    .select({ id: members.id, no: members.memberNo, name: members.nameBn, phone: members.phone })
    .from(members)
    .where(and(inArray(members.id, ids), eq(members.status, "active"), eq(members.mustChangePin, true)))
    .orderBy(asc(members.memberNo))

  // bcrypt is slow on purpose; hash before opening the transaction.
  const prepared: Invite[] = []
  const hashes = new Map<number, string>()
  for (const m of eligible) {
    const pin = generatePin()
    hashes.set(m.id, await bcrypt.hash(pin, 10))
    prepared.push({ ...m, pin })
  }

  await db.transaction(async (tx) => {
    for (const m of prepared) {
      // Re-check inside the transaction: someone may have just set their own password.
      const updated = await tx
        .update(members)
        .set({
          pinHash: hashes.get(m.id)!,
          mustChangePin: true,
          failedLogins: 0,
          lockedUntil: null,
          sessionVersion: sql`${members.sessionVersion} + 1`,
        })
        .where(and(eq(members.id, m.id), eq(members.mustChangePin, true), eq(members.status, "active")))
        .returning({ id: members.id })
      if (updated.length === 0) {
        m.pin = "" // lost the race; dropped below
        continue
      }
      await tx.insert(auditLog).values({ actorId, action: "invite_create", tableName: "members", rowId: String(m.id) })
    }
  })
  const invites = prepared.filter((m) => m.pin !== "")
  return { invites, skipped: ids.length - invites.length }
}
