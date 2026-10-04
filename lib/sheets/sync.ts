// One-way mirror app → Google Sheet (spec §9).
// Writes put a row in sheet_outbox inside their DB transaction; after the response,
// flushSheetOutbox() pushes pending rows. The daily cron retries failures, and on
// Sundays rewrites every tab from the database to fix any drift.
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { getDb } from "@/lib/db"
import { sheetOutbox, transactions } from "@/lib/db/schema"
import { loadSnapshot, loadTransactions } from "@/lib/data"
import { memberRows, paymentRows, summaryRows, TABS, transactionRow, type Row, type TabName } from "./rows"

export interface SheetTarget {
  ensureTabs(tabs: TabName[]): Promise<void>
  upsertRows(tab: TabName, rows: Row[]): Promise<void>
  rewriteTab(tab: TabName, rows: Row[]): Promise<void>
}

const ALL_TABS: TabName[] = [TABS.members, TABS.payments, TABS.transactions, TABS.summary]
const BATCH = 300
const MAX_ROUNDS = 5
const LOCK_KEY = 7_340_001 // arbitrary constant for pg_try_advisory_xact_lock

export async function googleTarget(): Promise<SheetTarget | null> {
  const { getSheetsApi, ensureTabs, upsertRows, rewriteTab } = await import("./client")
  const g = await getSheetsApi()
  if (!g) return null
  return {
    ensureTabs: (tabs) => ensureTabs(g.api, g.sheetId, tabs),
    upsertRows: (tab, rows) => upsertRows(g.api, g.sheetId, tab, rows),
    rewriteTab: (tab, rows) => rewriteTab(g.api, g.sheetId, tab, rows),
  }
}

export type FlushResult = { pushed: number; failed: number; skipped?: "not_configured" | "locked" }

/** Push pending (and optionally failed) outbox rows. Safe to call concurrently. */
export async function flushOutbox(db: DB, target: SheetTarget, opts: { includeFailed?: boolean } = {}): Promise<FlushResult> {
  const result: FlushResult = { pushed: 0, failed: 0 }
  const statuses = opts.includeFailed ? or(eq(sheetOutbox.status, "pending"), eq(sheetOutbox.status, "failed")) : eq(sheetOutbox.status, "pending")
  let tabsReady = false

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const outcome = await db.transaction(async (tx) => {
      // One flusher at a time; others skip (their rows are picked up by this loop or the cron).
      // Neon and PGlite both return { rows }, but the generic PgDatabase type can't express it.
      const lock = (await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`)) as unknown as {
        rows: { locked: boolean }[]
      }
      if (!lock.rows[0]?.locked) return "locked" as const

      const batch = await tx.select().from(sheetOutbox).where(statuses).orderBy(asc(sheetOutbox.id)).limit(BATCH)
      if (batch.length === 0) return "empty" as const
      const ids = batch.map((b) => b.id)
      try {
        if (!tabsReady) {
          await target.ensureTabs(ALL_TABS)
          tabsReady = true
        }
        await pushBatch(tx as unknown as DB, target, batch)
        await tx
          .update(sheetOutbox)
          .set({ status: "done", processedAt: new Date(), attempts: sql`${sheetOutbox.attempts} + 1`, lastError: null })
          .where(inArray(sheetOutbox.id, ids))
        result.pushed += batch.length
        return batch.length < BATCH ? ("empty" as const) : ("more" as const)
      } catch (err) {
        await tx
          .update(sheetOutbox)
          .set({ status: "failed", attempts: sql`${sheetOutbox.attempts} + 1`, lastError: String(err).slice(0, 1000) })
          .where(inArray(sheetOutbox.id, ids))
        result.failed += batch.length
        return "error" as const
      }
    })
    if (outcome === "locked") return { ...result, skipped: result.pushed ? undefined : "locked" }
    if (outcome !== "more") break
  }
  return result
}

async function pushBatch(db: DB, target: SheetTarget, batch: { kind: string; payload: unknown }[]) {
  const idsOf = (kind: string) =>
    new Set(batch.filter((b) => b.kind === kind).map((b) => Number((b.payload as { id?: number })?.id)).filter(Number.isFinite))
  const memberIds = idsOf("member")
  const paymentIds = idsOf("payment")
  const txnIds = idsOf("transaction")

  const snap = await loadSnapshot(db)
  // A payment changes the payer's totals, so refresh their member row too.
  for (const m of snap.members) if (m.payments.some((p) => paymentIds.has(p.id))) memberIds.add(m.member.id)

  if (memberIds.size) await target.upsertRows(TABS.members, memberRows(snap, memberIds))
  if (paymentIds.size) await target.upsertRows(TABS.payments, paymentRows(snap, paymentIds))
  if (txnIds.size) {
    const rows = await db.select().from(transactions).where(inArray(transactions.id, [...txnIds])).orderBy(asc(transactions.id))
    await target.upsertRows(TABS.transactions, rows.map(transactionRow))
  }
  // Small (one row per month) — always rebuilt.
  await target.rewriteTab(TABS.summary, summaryRows(snap))
}

/** Rewrite every tab from the database and mark the outbox as done. */
export async function fullRewrite(db: DB, target: SheetTarget) {
  // Hold the same lock as flushOutbox (waiting for it), so an incremental push can't write
  // into row positions that are being rewritten.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_KEY})`)
    await rewriteAll(tx as unknown as DB, target)
  })
}

async function rewriteAll(db: DB, target: SheetTarget) {
  await target.ensureTabs(ALL_TABS)
  const startedAt = new Date()
  const [snap, txns] = await Promise.all([loadSnapshot(db), loadTransactions(db)])
  await target.rewriteTab(TABS.members, memberRows(snap))
  await target.rewriteTab(TABS.payments, paymentRows(snap))
  await target.rewriteTab(TABS.transactions, [...txns].sort((a, b) => a.id - b.id).map(transactionRow))
  await target.rewriteTab(TABS.summary, summaryRows(snap))
  // Everything queued before the rewrite started is now reflected.
  await db
    .update(sheetOutbox)
    .set({ status: "done", processedAt: new Date(), lastError: null })
    .where(and(or(eq(sheetOutbox.status, "pending"), eq(sheetOutbox.status, "failed")), lt(sheetOutbox.createdAt, startedAt)))
}

/** Called via after() following every successful admin write. No-op until Sheets is configured. */
export async function flushSheetOutbox(): Promise<FlushResult> {
  const target = await googleTarget()
  if (!target) return { pushed: 0, failed: 0, skipped: "not_configured" }
  return flushOutbox(getDb(), target)
}
