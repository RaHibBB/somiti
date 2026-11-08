import { and, desc, eq } from "drizzle-orm"
import type { DB, Tx } from "@/lib/db"
import { profitDistributions, projectEvents, projects, proposals, settings, transactions, type Project } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { formatDate, monthLabel, todayDhaka } from "@/lib/format"
import { monthDiff, monthOf } from "@/lib/ledger"
import { samitiYear } from "@/lib/profit"
import { projectTotals } from "@/lib/projects"
import { UserError } from "./errors"

export type ProjectInput = {
  name: string
  description: string | null
  startedOn: string
  proposalId: number | null
  budget: number | null
}

/** Latest close/reopen event decides: closed or open. */
async function stateOf(db: DB | Tx, projectId: number): Promise<{ closed: boolean; closedOn: string | null }> {
  const [last] = await db.select().from(projectEvents).where(eq(projectEvents.projectId, projectId)).orderBy(desc(projectEvents.id)).limit(1)
  return last?.kind === "close" ? { closed: true, closedOn: last.eventDate } : { closed: false, closedOn: null }
}

/** The saved, valid profit distribution covering `date`'s samiti year, if any. */
async function distributionFor(db: DB | Tx, date: string) {
  const [s] = await db.select({ startMonth: settings.startMonth }).from(settings).limit(1)
  const index = Math.max(0, Math.floor(monthDiff(s.startMonth, monthOf(date)) / 12))
  const { periodStart } = samitiYear(s.startMonth, index)
  const [d] = await db
    .select({ id: profitDistributions.id, periodLabel: profitDistributions.periodLabel })
    .from(profitDistributions)
    .where(and(eq(profitDistributions.periodStart, periodStart), eq(profitDistributions.status, "valid")))
    .limit(1)
  return d ?? null
}

/**
 * For adding or voiding an entry: the project must exist and be open. Locks the project row,
 * so an entry and a "close project" can't slip past each other.
 */
export async function assertProjectOpen(tx: DB | Tx, projectId: number): Promise<Project> {
  const [p] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update")
  if (!p) throw new UserError("প্রকল্প পাওয়া যায়নি।")
  if ((await stateOf(tx, projectId)).closed) {
    throw new UserError(`"${p.name}" প্রকল্প শেষ করা আছে। এন্ট্রি যোগ বা বাতিল করতে আগে প্রকল্পটি আবার খুলুন (কারণ লিখে)।`)
  }
  return p
}

export async function createProject(db: DB, actorId: number, input: ProjectInput, today = todayDhaka()): Promise<Project> {
  const name = input.name.trim()
  if (name.length < 2) throw new UserError("প্রকল্পের নাম লিখুন।")
  if (name.length > 120) throw new UserError("প্রকল্পের নাম ছোট করুন (১২০ অক্ষরের মধ্যে)।")
  if (input.startedOn > today) throw new UserError("শুরুর তারিখ ভবিষ্যতের হতে পারে না।")
  if (input.budget !== null && (!Number.isInteger(input.budget) || input.budget <= 0)) throw new UserError("বাজেট সঠিক নয়।")
  let budget = input.budget
  if (input.proposalId) {
    const [p] = await db.select().from(proposals).where(eq(proposals.id, input.proposalId))
    if (!p) throw new UserError("প্রস্তাব পাওয়া যায়নি।")
    if (p.status !== "passed") throw new UserError("শুধু পাস হওয়া প্রস্তাবের সাথে প্রকল্প যুক্ত করা যায়।")
    budget ??= p.amount
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({ name, description: input.description?.trim() || null, startedOn: input.startedOn, proposalId: input.proposalId, budget, createdBy: actorId })
      .returning()
    await writeAudit(tx, { actorId, action: "project_create", table: "projects", rowId: row.id, after: row })
    return row
  })
}

/**
 * Close a project (e.g. the cow is sold). Its result counts as profit/loss in the samiti year
 * of `closedOn`, so that year's distribution must not be saved yet.
 */
export async function closeProject(db: DB, actorId: number, projectId: number, closedOn: string, note: string | null, today = todayDhaka()) {
  if (closedOn > today) throw new UserError("শেষের তারিখ ভবিষ্যতের হতে পারে না।")
  return db.transaction(async (tx) => {
    const p = await assertProjectOpen(tx, projectId)
    if (closedOn < p.startedOn) throw new UserError(`শেষের তারিখ শুরুর তারিখের (${formatDate(p.startedOn)}) আগে হতে পারে না।`)
    const entries = (await tx.select().from(transactions).where(eq(transactions.projectId, projectId))).filter((t) => t.status === "valid")
    if (entries.length === 0) throw new UserError("এই প্রকল্পে এখনো কোনো এন্ট্রি নেই — শেষ করার কিছু নেই।")
    const lastEntry = entries.reduce((m, t) => (t.date > m ? t.date : m), entries[0].date)
    if (closedOn < lastEntry) throw new UserError(`শেষের তারিখ শেষ এন্ট্রির তারিখের (${formatDate(lastEntry)}) আগে হতে পারে না।`)
    const dist = await distributionFor(tx, closedOn)
    if (dist) {
      throw new UserError(`${dist.periodLabel}-এর মুনাফা বণ্টন আগেই সংরক্ষণ করা হয়েছে, তাই এই বছরে প্রকল্প শেষ দেখানো যাবে না। পরের বছরের কোনো তারিখ দিন, অথবা আগে বণ্টনটি বাতিল করুন।`)
    }
    const totals = projectTotals(entries)
    const [ev] = await tx.insert(projectEvents).values({ projectId, kind: "close", eventDate: closedOn, reason: note?.trim() || null, byId: actorId }).returning()
    await writeAudit(tx, { actorId, action: "project_close", table: "project_events", rowId: ev.id, after: { ...ev, name: p.name, totals } })
    return { event: ev, totals }
  })
}

/** Reopen a closed project (a mistake, or more entries to come). Needs a reason; not after its year's distribution. */
export async function reopenProject(db: DB, actorId: number, projectId: number, reason: string, today = todayDhaka()) {
  const r = reason.trim()
  if (r.length < 3) throw new UserError("আবার খোলার কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।")
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update")
    if (!p) throw new UserError("প্রকল্প পাওয়া যায়নি।")
    const st = await stateOf(tx, projectId)
    if (!st.closed || !st.closedOn) throw new UserError("প্রকল্পটি চালু আছে, খোলার দরকার নেই।")
    const dist = await distributionFor(tx, st.closedOn)
    if (dist) {
      throw new UserError(`এই প্রকল্পের লাভ ${dist.periodLabel}-এর মুনাফা বণ্টনে ধরা হয়ে গেছে (শেষ ${monthLabel(monthOf(st.closedOn))})। খুলতে হলে আগে সেই বণ্টনটি বাতিল করুন।`)
    }
    const [ev] = await tx.insert(projectEvents).values({ projectId, kind: "reopen", eventDate: today, reason: r, byId: actorId }).returning()
    await writeAudit(tx, { actorId, action: "project_reopen", table: "project_events", rowId: ev.id, after: { ...ev, name: p.name } })
    return ev
  })
}
