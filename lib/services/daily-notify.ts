import { and, asc, eq, gt, isNotNull, lte } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { cashHandovers, proposals, votes } from "@/lib/db/schema"
import { loadSnapshot, loadTransactions } from "@/lib/data"
import { monthLabel, taka, toBn } from "@/lib/format"
import { monthHoldings } from "@/lib/holdings"
import { addMonths, monthOf } from "@/lib/ledger"
import type { NewNotification } from "@/lib/notify"

/**
 * Reminders the daily cron sends. Each has a dedupe key, so running twice a day (or a retry)
 * never sends one twice; each also has a small window of days, so a missed cron day doesn't
 * lose it.
 *
 *  - due soon:   dueDay−2 … dueDay      this month not fully paid yet
 *  - overdue:    dueDay+1 … dueDay+5    something is overdue
 *  - vote:       an open vote closes within 24 hours and the member hasn't voted
 *  - cash:       1st … 3rd of a month   an admin still holds last month's money
 */
export async function dailyNotifications(db: DB, today: string, now = new Date()): Promise<NewNotification[]> {
  const snap = await loadSnapshot(db, today)
  const dueDay = snap.settings.dueDay
  const day = Number(today.slice(8, 10))
  const month = monthOf(today)
  const key = month.slice(0, 7)
  const active = snap.members.filter((m) => m.member.status === "active")
  const out: NewNotification[] = []

  if (day >= dueDay - 2 && day <= dueDay) {
    for (const m of active) {
      const line = m.lines.find((l) => l.month === month)
      if (!line || line.remaining <= 0) continue
      out.push({
        memberId: m.member.id,
        kind: "due",
        title: `${monthLabel(month)}-এর চাঁদা বাকি`,
        body: `${taka(line.remaining)} — ${toBn(dueDay)} তারিখের মধ্যে দিন। বিকাশ/ব্যাংকে পাঠিয়ে অ্যাপে জানাতে পারেন।`,
        url: "/report",
        dedupeKey: `due-soon:${key}:${m.member.id}`,
      })
    }
  }

  if (day > dueDay && day <= dueDay + 5) {
    for (const m of active) {
      if (m.due <= 0) continue
      out.push({
        memberId: m.member.id,
        kind: "due",
        title: "চাঁদা বকেয়া হয়েছে",
        body: `আপনার বকেয়া ${taka(m.due)}। সুবিধামতো দ্রুত দিয়ে দিন — বিকাশ/ব্যাংকে পাঠিয়ে অ্যাপে জানাতে পারেন।`,
        url: "/report",
        dedupeKey: `overdue:${key}:${m.member.id}`,
      })
    }
  }

  // Votes closing within a day: remind members who haven't voted.
  const closing = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.status, "open"), isNotNull(proposals.closesAt), gt(proposals.closesAt, now), lte(proposals.closesAt, new Date(now.getTime() + 24 * 3600 * 1000))))
  for (const p of closing) {
    const voted = new Set((await db.select({ memberId: votes.memberId }).from(votes).where(eq(votes.proposalId, p.id))).map((v) => v.memberId))
    for (const m of active) {
      if (voted.has(m.member.id)) continue
      out.push({
        memberId: m.member.id,
        kind: "vote",
        title: "ভোট শেষ হচ্ছে",
        body: `"${p.title}" — আপনার ভোট এখনো দেননি। আগামীকালের মধ্যে ভোট দিন।`,
        url: `/proposals/${p.id}`,
        dedupeKey: `vote-closing:${p.id}:${m.member.id}`,
      })
    }
  }

  // First days of a month: admins still holding last month's money.
  if (day <= 3) {
    const prev = addMonths(month, -1)
    if (prev >= snap.settings.startMonth) {
      const [handovers, txns] = await Promise.all([db.select().from(cashHandovers).orderBy(asc(cashHandovers.id)), loadTransactions(db)])
      const h = monthHoldings(
        snap.members.flatMap((m) => m.payments),
        handovers,
        prev,
        txns,
      )
      for (const holder of h.holders) {
        if (holder.closing <= 0) continue
        out.push({
          memberId: holder.id,
          kind: "admin",
          title: "হাতে সমিতির টাকা আছে",
          body: `${monthLabel(prev)} শেষে আপনার হাতে ${taka(holder.closing)}। ব্যাংকে জমা দিয়ে অ্যাপে "ব্যাংকে জমা দিয়েছি" চাপুন।`,
          url: `/admin/holdings?month=${prev.slice(0, 7)}`,
          dedupeKey: `cash:${prev.slice(0, 7)}:${holder.id}`,
        })
      }
    }
  }
  return out
}
