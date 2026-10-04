import bcrypt from "bcryptjs"
import { and, eq, max, ne, sql } from "drizzle-orm"
import type { DB, Tx } from "@/lib/db"
import { members, shareHistory, type Member } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { enqueueSheet } from "@/lib/outbox"
import { generatePin } from "@/lib/auth/pin"
import { monthOf } from "@/lib/ledger"
import { todayDhaka } from "@/lib/format"
import { isUniqueViolation, UserError } from "./errors"

/** No real limit on shares; this only catches typos (e.g. 5000 instead of 5). */
export const MAX_SHARES = 999

export type MemberInput = {
  memberNo: number
  nameBn: string
  phone: string | null
  email: string | null
  role: "member" | "admin"
  joinedOn: string
  nomineeName: string | null
  nomineePhone: string | null
  notes: string | null
}

/** Member row without the PIN hash, for audit snapshots. */
function publicFields(m: Member) {
  return { ...m, pinHash: undefined }
}

function rethrowFriendly(err: unknown): never {
  if (isUniqueViolation(err, "members_member_no_unique")) throw new UserError("এই সদস্য নম্বর আগেই আছে।")
  if (isUniqueViolation(err, "members_phone_unique")) throw new UserError("এই মোবাইল নম্বর অন্য সদস্যের নামে আছে।")
  if (isUniqueViolation(err, "members_email_unique")) throw new UserError("এই ইমেইল অন্য সদস্যের নামে আছে।")
  throw err
}

export async function nextMemberNo(db: DB): Promise<number> {
  const [r] = await db.select({ n: max(members.memberNo) }).from(members)
  return (r?.n ?? 0) + 1
}

async function assertAnotherAdmin(tx: Tx, exceptId: number) {
  // Lock every active admin row so two admins can't demote/cancel each other at the same moment.
  const others = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.role, "admin"), eq(members.status, "active"), ne(members.id, exceptId)))
    .orderBy(members.id)
    .for("update")
  if (others.length < 1) throw new UserError("কমপক্ষে একজন সক্রিয় অ্যাডমিন থাকতে হবে।")
}

export async function createMember(
  db: DB,
  actorId: number,
  input: MemberInput & { shares: number; shareStartMonth: string; pin?: string },
): Promise<{ member: Member; pin: string }> {
  if (!Number.isInteger(input.shares) || input.shares < 1 || input.shares > MAX_SHARES) {
    throw new UserError("শেয়ার সংখ্যা সঠিক নয় (কমপক্ষে ১)।")
  }
  const pin = input.pin ?? generatePin()
  const pinHash = await bcrypt.hash(pin, 10)
  try {
    return await db.transaction(async (tx) => {
      const [member] = await tx
        .insert(members)
        .values({
          memberNo: input.memberNo,
          nameBn: input.nameBn,
          phone: input.phone,
          email: input.email,
          role: input.role,
          joinedOn: input.joinedOn,
          nomineeName: input.nomineeName,
          nomineePhone: input.nomineePhone,
          notes: input.notes,
          pinHash,
          mustChangePin: true,
        })
        .returning()
      const [share] = await tx
        .insert(shareHistory)
        .values({ memberId: member.id, shares: input.shares, effectiveMonth: input.shareStartMonth, setBy: actorId })
        .returning()
      await writeAudit(tx, { actorId, action: "member_create", table: "members", rowId: member.id, after: publicFields(member) })
      await writeAudit(tx, { actorId, action: "shares_set", table: "share_history", rowId: share.id, after: share })
      await enqueueSheet(tx, "member", member.id)
      return { member, pin }
    })
  } catch (err) {
    rethrowFriendly(err)
  }
}

export async function updateMember(db: DB, actorId: number, memberId: number, input: MemberInput): Promise<Member> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(members).where(eq(members.id, memberId)).for("update")
      if (!before) throw new UserError("সদস্য পাওয়া যায়নি।")
      if (before.role === "admin" && input.role !== "admin") await assertAnotherAdmin(tx, memberId)
      const roleChanged = before.role !== input.role
      const [after] = await tx
        .update(members)
        .set({
          ...input,
          // A role change logs the member out everywhere so the new role applies cleanly.
          sessionVersion: roleChanged ? sql`${members.sessionVersion} + 1` : before.sessionVersion,
        })
        .where(eq(members.id, memberId))
        .returning()
      await writeAudit(tx, {
        actorId,
        action: "member_update",
        table: "members",
        rowId: memberId,
        before: publicFields(before),
        after: publicFields(after),
      })
      await enqueueSheet(tx, "member", memberId)
      return after
    })
  } catch (err) {
    rethrowFriendly(err)
  }
}

/**
 * New share count from `effectiveMonth`. Past months can't be changed (old dues must stay as they were),
 * except for a member who has no share history yet (e.g. flagged during the sheet import).
 */
export async function changeShares(
  db: DB,
  actorId: number,
  memberId: number,
  shares: number,
  effectiveMonth: string,
  today = todayDhaka(),
) {
  if (!Number.isInteger(shares) || shares < 1 || shares > MAX_SHARES) throw new UserError("শেয়ার সংখ্যা সঠিক নয় (কমপক্ষে ১)।")
  if (!/^\d{4}-\d{2}-01$/.test(effectiveMonth)) throw new UserError("মাস সঠিক নয়।")
  return db.transaction(async (tx) => {
    const [m] = await tx.select({ id: members.id }).from(members).where(eq(members.id, memberId))
    if (!m) throw new UserError("সদস্য পাওয়া যায়নি।")
    if (effectiveMonth < monthOf(today)) {
      const [prior] = await tx.select({ id: shareHistory.id }).from(shareHistory).where(eq(shareHistory.memberId, memberId)).limit(1)
      if (prior) throw new UserError("আগের মাসের শেয়ার বদলানো যায় না (পুরনো হিসাব বদলে যাবে)। এই মাস বা পরের কোনো মাস বাছুন।")
    }
    const [row] = await tx.insert(shareHistory).values({ memberId, shares, effectiveMonth, setBy: actorId }).returning()
    await writeAudit(tx, { actorId, action: "shares_set", table: "share_history", rowId: row.id, after: row })
    await enqueueSheet(tx, "member", memberId)
    return row
  })
}

export async function cancelMember(db: DB, actorId: number, memberId: number, reason: string) {
  if (!reason.trim()) throw new UserError("বাতিলের কারণ লিখুন।")
  if (memberId === actorId) throw new UserError("নিজের সদস্যপদ নিজে বাতিল করা যাবে না।")
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(members).where(eq(members.id, memberId)).for("update")
    if (!before) throw new UserError("সদস্য পাওয়া যায়নি।")
    if (before.status === "cancelled") throw new UserError("এই সদস্যপদ আগেই বাতিল।")
    if (before.role === "admin") await assertAnotherAdmin(tx, memberId)
    const [after] = await tx
      .update(members)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
        sessionVersion: sql`${members.sessionVersion} + 1`,
      })
      .where(eq(members.id, memberId))
      .returning()
    await writeAudit(tx, {
      actorId,
      action: "member_cancel",
      table: "members",
      rowId: memberId,
      before: publicFields(before),
      after: publicFields(after),
    })
    await enqueueSheet(tx, "member", memberId)
    return after
  })
}

/** New random 6-digit temporary password; forces a change on next login and logs the member out everywhere. */
export async function resetPin(db: DB, actorId: number, memberId: number): Promise<{ pin: string; member: Member }> {
  const pin = generatePin()
  const pinHash = await bcrypt.hash(pin, 10)
  return db.transaction(async (tx) => {
    const [member] = await tx
      .update(members)
      .set({
        pinHash,
        mustChangePin: true,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: sql`${members.sessionVersion} + 1`,
      })
      .where(eq(members.id, memberId))
      .returning()
    if (!member) throw new UserError("সদস্য পাওয়া যায়নি।")
    await writeAudit(tx, { actorId, action: "pin_reset", table: "members", rowId: memberId })
    return { pin, member }
  })
}
