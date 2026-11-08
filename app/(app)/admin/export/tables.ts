import { asc } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members, notices, payments, projectEvents, projects, settings, shareHistory, sheetOutbox, transactions } from "@/lib/db/schema"

export const EXPORTS = {
  members: { label: "সদস্য" },
  share_history: { label: "শেয়ারের ইতিহাস" },
  payments: { label: "চাঁদা জমা" },
  transactions: { label: "আয়-ব্যয় ও বিনিয়োগ" },
  projects: { label: "প্রকল্প" },
  project_events: { label: "প্রকল্প শেষ/খোলার ইতিহাস" },
  notices: { label: "নোটিশ" },
  settings: { label: "সেটিংস" },
  audit_log: { label: "অডিট লগ" },
  sheet_outbox: { label: "শিট সিঙ্ক কিউ" },
} as const

export type ExportName = keyof typeof EXPORTS

export async function exportRows(db: DB, name: ExportName): Promise<Record<string, unknown>[]> {
  switch (name) {
    case "members": {
      const rows = await db.select().from(members).orderBy(asc(members.memberNo))
      // Never export PIN hashes.
      return rows.map((r) => {
        const rest: Partial<typeof r> = { ...r }
        delete rest.pinHash
        return rest
      })
    }
    case "share_history":
      return db.select().from(shareHistory).orderBy(asc(shareHistory.id))
    case "payments":
      return db.select().from(payments).orderBy(asc(payments.receiptNo))
    case "transactions":
      return db.select().from(transactions).orderBy(asc(transactions.id))
    case "projects":
      return db.select().from(projects).orderBy(asc(projects.id))
    case "project_events":
      return db.select().from(projectEvents).orderBy(asc(projectEvents.id))
    case "notices":
      return db.select().from(notices).orderBy(asc(notices.id))
    case "settings":
      return db.select().from(settings)
    case "audit_log":
      return db.select().from(auditLog).orderBy(asc(auditLog.id))
    case "sheet_outbox":
      return db.select().from(sheetOutbox).orderBy(asc(sheetOutbox.id))
  }
}
