import "server-only"
import { auditLog } from "@/lib/db/schema"
import type { Tx } from "@/lib/db"

export type AuditInput = {
  actorId: number | null
  action: string
  table: string
  rowId?: string | number | null
  before?: unknown
  after?: unknown
}

// Never store secrets in the audit log.
const REDACT = new Set(["pinHash", "pin_hash"])

function clean(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(clean)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.has(k) ? "[redacted]" : v]),
  )
}

/** Record a write. Call inside the same transaction as the write itself. */
export async function writeAudit(tx: Tx, input: AuditInput) {
  await tx.insert(auditLog).values({
    actorId: input.actorId,
    action: input.action,
    tableName: input.table,
    rowId: input.rowId === undefined || input.rowId === null ? null : String(input.rowId),
    before: clean(input.before),
    after: clean(input.after),
  })
}
