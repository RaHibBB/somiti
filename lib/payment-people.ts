import { and, eq, inArray } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog } from "@/lib/db/schema"

/** Who did what to a payment, by name — shown to admins under each receipt. */
export type PaymentPeople = { received?: string; entered?: string; voided?: string }

/**
 * Looks up, from the audit log, which admin entered (and, if voided, who voided) each payment.
 * `receivedBy` is already on the payment row (with receiver fixes applied in loadSnapshot).
 */
export async function paymentPeople(
  db: DB,
  pays: { id: number; receivedBy: number | null }[],
  nameOf: (id: number) => string,
): Promise<Record<number, PaymentPeople>> {
  const out: Record<number, PaymentPeople> = {}
  if (pays.length === 0) return out
  for (const p of pays) out[p.id] = p.receivedBy ? { received: nameOf(p.receivedBy) } : {}
  const rows = await db
    .select({ action: auditLog.action, rowId: auditLog.rowId, actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, "payments"),
        inArray(auditLog.action, ["payment_create", "payment_void"]),
        inArray(
          auditLog.rowId,
          pays.map((p) => String(p.id)),
        ),
      ),
    )
  for (const r of rows) {
    const id = Number(r.rowId)
    if (!out[id] || !r.actorId) continue
    if (r.action === "payment_create") out[id].entered = nameOf(r.actorId)
    else out[id].voided = nameOf(r.actorId)
  }
  return out
}
