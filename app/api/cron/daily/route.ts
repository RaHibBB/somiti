import { cronAuthorized, isSundayInDhaka } from "@/lib/cron"
import { getDb } from "@/lib/db"
import { todayDhaka } from "@/lib/format"
import { notify } from "@/lib/notify"
import { dailyNotifications } from "@/lib/services/daily-notify"
import { closeExpiredProposals } from "@/lib/services/proposals"
import { flushOutbox, fullRewrite, googleTarget } from "@/lib/sheets/sync"

// The ONE daily job (vercel.json, 03:00 UTC = 09:00 Asia/Dhaka). Everything daily runs here so
// the free Neon database wakes up once a day for background work instead of once per job:
//   1. close votes past their deadline
//   2. reminders (dues, votes closing, cash in hand) — each deduped, safe to re-run
//   3. Google Sheet mirror: retry pending/failed rows; full rewrite on Sundays (or ?full=1)
// Each step runs even if an earlier one fails; the response lists what happened.
export const maxDuration = 60

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 })
  const db = getDb()
  const out: Record<string, unknown> = {}

  try {
    out.proposalsClosed = await closeExpiredProposals(db)
  } catch (err) {
    console.error("daily: close proposals failed", err)
    out.proposalsError = String(err).slice(0, 200)
  }

  try {
    const items = await dailyNotifications(db, todayDhaka())
    out.notificationsSent = (await notify(db, items)).length
  } catch (err) {
    console.error("daily: notifications failed", err)
    out.notificationsError = String(err).slice(0, 200)
  }

  try {
    const target = await googleTarget()
    if (!target) out.sheet = "not configured"
    else {
      out.sheetFlushed = await flushOutbox(db, target, { includeFailed: true })
      const full = new URL(request.url).searchParams.get("full") === "1" || isSundayInDhaka()
      if (full) await fullRewrite(db, target)
      out.sheetFullRewrite = full
    }
  } catch (err) {
    // e.g. 403 when the sheet isn't shared with the service account as Editor.
    console.error("daily: sheet sync failed", err)
    out.sheetError = String((err as { message?: string })?.message ?? err).slice(0, 300)
  }

  const ok = !out.proposalsError && !out.notificationsError && !out.sheetError
  return Response.json({ ok, ...out }, { status: ok ? 200 : 502 })
}
