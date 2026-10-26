import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { cashHandovers, members, type CashHandover } from "@/lib/db/schema"
import { writeAudit } from "@/lib/audit"
import { todayDhaka } from "@/lib/format"
import { UserError } from "./errors"
import { assertMonthOpen } from "./month-close"

export type HandoverInput = {
  fromId: number
  /** null = deposited in the samiti's bank account */
  toId: number | null
  amount: number
  date: string
  note: string | null
}

async function mustBeActiveAdmin(db: DB, id: number, what: string) {
  const [m] = await db.select().from(members).where(eq(members.id, id))
  if (!m || m.status !== "active" || m.role !== "admin") throw new UserError(`${what} একজন সক্রিয় অ্যাডমিন হতে হবে।`)
}

export async function createHandover(db: DB, actorId: number, input: HandoverInput, today = todayDhaka()): Promise<CashHandover> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new UserError("টাকার পরিমাণ সঠিক নয়।")
  if (input.date > today) throw new UserError("তারিখ ভবিষ্যতের হতে পারে না।")
  if (input.toId === input.fromId) throw new UserError("নিজেকেই টাকা দেওয়া যায় না।")
  await mustBeActiveAdmin(db, input.fromId, "যিনি টাকা দিচ্ছেন তিনি")
  if (input.toId) await mustBeActiveAdmin(db, input.toId, "যিনি টাকা পাচ্ছেন তিনি")
  await assertMonthOpen(db, input.date)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cashHandovers)
      .values({ ...input, note: input.note?.trim() || null, createdBy: actorId })
      .returning()
    await writeAudit(tx, { actorId, action: "handover_create", table: "cash_handovers", rowId: row.id, after: row })
    return row
  })
}

export async function voidHandover(db: DB, actorId: number, id: number, reason: string): Promise<CashHandover> {
  const voidReason = reason.trim()
  if (voidReason.length < 3) throw new UserError("বাতিলের কারণ লিখুন (কমপক্ষে ৩ অক্ষর)।")
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(cashHandovers).where(eq(cashHandovers.id, id)).for("update")
    if (!before) throw new UserError("হস্তান্তর পাওয়া যায়নি।")
    if (before.status === "void") throw new UserError("এটি আগেই বাতিল করা হয়েছে।")
    await assertMonthOpen(tx, before.date)
    const [after] = await tx
      .update(cashHandovers)
      .set({ status: "void", voidReason, voidedBy: actorId, voidedAt: new Date() })
      .where(eq(cashHandovers.id, id))
      .returning()
    await writeAudit(tx, { actorId, action: "handover_void", table: "cash_handovers", rowId: id, before, after })
    return after
  })
}
