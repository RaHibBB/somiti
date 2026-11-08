import { timingSafeEqual } from "node:crypto"
import { getDb } from "@/lib/db"
import { todayDhaka } from "@/lib/format"
import { notify } from "@/lib/notify"
import { dailyNotifications } from "@/lib/services/daily-notify"

// Vercel Cron, daily at 09:00 Asia/Dhaka (see vercel.json): due reminders, votes closing,
// admins still holding last month's money. Safe to run more than once: every reminder has a
// dedupe key.
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 })
  const db = getDb()
  const items = await dailyNotifications(db, todayDhaka())
  const sent = await notify(db, items)
  return Response.json({ ok: true, candidates: items.length, sent: sent.length })
}
