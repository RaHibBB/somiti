import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, notices, type Notice } from "@/lib/db/schema"
import { UserError } from "./errors"

export async function createNotice(db: DB, actorId: number, title: string, body: string): Promise<Notice> {
  if (!title.trim() || !body.trim()) throw new UserError("শিরোনাম ও লেখা দুটোই দিন।")
  return db.transaction(async (tx) => {
    const [n] = await tx.insert(notices).values({ title: title.trim(), body: body.trim(), createdBy: actorId }).returning()
    await tx.insert(auditLog).values({ actorId, action: "notice_create", tableName: "notices", rowId: String(n.id), after: n })
    return n
  })
}

/** Notices are never deleted; they are archived (hidden from members) or restored. */
export async function setNoticeStatus(db: DB, actorId: number, id: number, status: "active" | "archived"): Promise<Notice> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(notices).where(eq(notices.id, id))
    if (!before) throw new UserError("নোটিশ পাওয়া যায়নি।")
    const [after] = await tx.update(notices).set({ status }).where(eq(notices.id, id)).returning()
    await tx.insert(auditLog).values({
      actorId,
      action: status === "archived" ? "notice_archive" : "notice_restore",
      tableName: "notices",
      rowId: String(id),
      before,
      after,
    })
    return after
  })
}
