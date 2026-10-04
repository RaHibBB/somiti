import { timingSafeEqual } from "node:crypto"
import { getDb } from "@/lib/db"
import { closeExpiredProposals } from "@/lib/services/proposals"
import { flushOutbox, fullRewrite, googleTarget } from "@/lib/sheets/sync"

// Vercel Cron (daily, see vercel.json). Retries pending/failed outbox rows; on Sundays
// (Asia/Dhaka) also rewrites every tab from the database. `?full=1` forces a rewrite.
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function isSundayInDhaka(now = new Date()): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", weekday: "short" }).format(now) === "Sun"
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 })
  // Votes past their deadline are closed even if nobody opens the proposal pages.
  const proposalsClosed = await closeExpiredProposals(getDb())
  const target = await googleTarget()
  if (!target) return Response.json({ ok: false, proposalsClosed, error: "Google Sheets is not configured" }, { status: 500 })

  const db = getDb()
  const full = new URL(request.url).searchParams.get("full") === "1" || isSundayInDhaka()
  try {
    const flushed = await flushOutbox(db, target, { includeFailed: true })
    if (full) await fullRewrite(db, target)
    return Response.json({ ok: true, proposalsClosed, flushed, fullRewrite: full })
  } catch (err) {
    // e.g. 403 when the sheet isn't shared with the service account as Editor.
    console.error("sheet sync failed", err)
    const message = (err as { message?: string })?.message ?? String(err)
    return Response.json({ ok: false, proposalsClosed, error: message.slice(0, 300) }, { status: 502 })
  }
}
