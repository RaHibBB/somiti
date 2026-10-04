import { and, asc, count, desc, eq, isNotNull, lte, sql } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members, proposals, votes, type Member } from "@/lib/db/schema"
import { tally } from "@/lib/voting"
import { UserError } from "./errors"

export type Proposal = typeof proposals.$inferSelect

export type ProposalInput = { title: string; description: string; amount: number | null; closesAt: Date }

export async function createProposal(db: DB, actorId: number, input: ProposalInput, now = new Date()): Promise<Proposal> {
  if (!input.title.trim()) throw new UserError("শিরোনাম লিখুন।")
  if (!input.description.trim()) throw new UserError("বিবরণ লিখুন।")
  if (input.closesAt <= now) throw new UserError("ভোট শেষের সময় ভবিষ্যতে হতে হবে।")
  return db.transaction(async (tx) => {
    const [p] = await tx
      .insert(proposals)
      .values({
        title: input.title.trim(),
        description: input.description.trim(),
        amount: input.amount,
        closesAt: input.closesAt,
        opensAt: now,
        status: "open",
        createdBy: actorId,
      })
      .returning()
    await tx.insert(auditLog).values({ actorId, action: "proposal_create", tableName: "proposals", rowId: String(p.id), after: p })
    return p
  })
}

/** Records a member's vote. One vote per member; votes can't be changed. */
export async function castVote(db: DB, member: Pick<Member, "id" | "status">, proposalId: number, choice: "yes" | "no", now = new Date()) {
  if (member.status !== "active") throw new UserError("শুধু সক্রিয় সদস্যরা ভোট দিতে পারবেন।")
  const [p] = await db.select().from(proposals).where(eq(proposals.id, proposalId))
  if (!p) throw new UserError("প্রস্তাব পাওয়া যায়নি।")
  if (p.status !== "open" || (p.closesAt && p.closesAt <= now)) throw new UserError("এই প্রস্তাবে ভোট শেষ হয়ে গেছে।")
  const [existing] = await db
    .select({ id: votes.id })
    .from(votes)
    .where(and(eq(votes.proposalId, proposalId), eq(votes.memberId, member.id)))
  if (existing) throw new UserError("আপনি আগেই ভোট দিয়েছেন।")
  return db.transaction(async (tx) => {
    const [v] = await tx.insert(votes).values({ proposalId, memberId: member.id, choice }).returning()
    // The audit entry records that a vote was cast, not which way (the tally is public; individual choices are kept in votes).
    await tx.insert(auditLog).values({ actorId: member.id, action: "vote_cast", tableName: "votes", rowId: String(v.id) })
    return v
  })
}

export async function countVotes(db: DB, proposalId: number) {
  const rows = await db
    .select({ choice: votes.choice, n: count() })
    .from(votes)
    .where(eq(votes.proposalId, proposalId))
    .groupBy(votes.choice)
  return {
    yes: rows.find((r) => r.choice === "yes")?.n ?? 0,
    no: rows.find((r) => r.choice === "no")?.n ?? 0,
  }
}

export async function activeMemberCount(db: DB): Promise<number> {
  const [r] = await db.select({ n: count() }).from(members).where(eq(members.status, "active"))
  return r?.n ?? 0
}

/** Close a proposal and freeze its result (quorum is measured against active members now). */
export async function closeProposal(db: DB, actorId: number | null, proposalId: number, now = new Date()): Promise<Proposal> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).for("update")
    if (!p) throw new UserError("প্রস্তাব পাওয়া যায়নি।")
    if (p.status !== "open") throw new UserError("প্রস্তাবটি আগেই বন্ধ হয়েছে।")
    const { yes, no } = await countVotes(tx as unknown as DB, proposalId)
    const active = await activeMemberCount(tx as unknown as DB)
    const result = tally(yes, no, active)
    const [closed] = await tx
      .update(proposals)
      .set({
        status: result.outcome,
        yesCount: yes,
        noCount: no,
        activeMembersAtClose: active,
        closedAt: now,
        closedBy: actorId,
      })
      .where(eq(proposals.id, proposalId))
      .returning()
    await tx
      .insert(auditLog)
      .values({ actorId, action: "proposal_close", tableName: "proposals", rowId: String(proposalId), before: p, after: closed })
    return closed
  })
}

/** Closes every open proposal whose deadline has passed. Called on page loads and by the daily cron. */
export async function closeExpiredProposals(db: DB, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.status, "open"), isNotNull(proposals.closesAt), lte(proposals.closesAt, now)))
  for (const { id } of due) {
    try {
      await closeProposal(db, null, id, now)
    } catch {
      // Another request closed it first — fine.
    }
  }
  return due.length
}

export async function listProposals(db: DB) {
  return db
    .select()
    .from(proposals)
    .orderBy(sql`CASE WHEN ${proposals.status} = 'open' THEN 0 ELSE 1 END`, desc(proposals.createdAt), asc(proposals.id))
}

export async function myVote(db: DB, proposalId: number, memberId: number) {
  const [v] = await db
    .select({ choice: votes.choice, createdAt: votes.createdAt })
    .from(votes)
    .where(and(eq(votes.proposalId, proposalId), eq(votes.memberId, memberId)))
  return v ?? null
}
