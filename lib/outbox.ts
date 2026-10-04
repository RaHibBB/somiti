import { sheetOutbox } from "@/lib/db/schema"
import type { Tx } from "@/lib/db"

export type OutboxKind = "member" | "payment" | "transaction"

/**
 * Queue a Google Sheet mirror update in the same DB transaction as the write.
 * The payload only names the row; the sync reads the row's current state when it
 * pushes, so a later void is reflected too.
 */
export async function enqueueSheet(tx: Tx, kind: OutboxKind, id: number) {
  await tx.insert(sheetOutbox).values({ kind, payload: { id } })
}
