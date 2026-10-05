import Link from "next/link"
import { AlertTriangle, MessageCircle } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { monthLabel, taka, toBn } from "@/lib/format"
import { monthOf, overdueMonths } from "@/lib/ledger"
import { WhatsappQueue } from "@/components/whatsapp-queue"
import { reminderMessage, upcomingReminderMessage, waLink } from "@/lib/whatsapp"

export default async function DuesPage() {
  await requireAdmin()
  const snap = await getSnapshot()
  const thisMonth = monthOf(snap.today)
  const active = snap.members.filter((m) => m.member.status === "active")
  // 1) Overdue: the 10th has passed.
  const rows = active.filter((m) => m.due > 0).sort((a, b) => b.due - a.due)
  const total = rows.reduce((s, r) => s + r.due, 0)
  // 2) Still inside the 1st–10th window but nothing/not everything paid yet.
  const upcoming = active.filter((m) => m.currentOpen > 0).sort((a, b) => b.currentOpen - a.currentOpen)
  const upcomingTotal = upcoming.reduce((s, r) => s + r.currentOpen, 0)

  return (
    <div className="space-y-5">
      <PageTitle>বকেয়া ও বাকি</PageTitle>

      <section className="space-y-3">
        <div className="rounded-xl bg-red-50 p-3">
          <p className="text-sm text-red-800">মেয়াদ পেরিয়েছে — {toBn(rows.length)} জন</p>
          <p className="text-2xl font-bold text-destructive">{taka(total)}</p>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">কারো মেয়াদ-পেরোনো বকেয়া নেই। 🎉</p>
        ) : null}
        <WhatsappQueue
          verb="রিমাইন্ডার পাঠানো"
          items={rows.map((r) => ({
            id: r.member.id,
            label: `${toBn(r.member.memberNo)}. ${r.member.nameBn}`,
            hasPhone: !!r.member.phone,
            link: waLink(
              r.member.phone,
              reminderMessage({
                name: r.member.nameBn,
                due: r.due,
                months: overdueMonths(r.lines).map((l) => l.month),
                dueDay: snap.settings.dueDay,
              }),
            ),
          }))}
        />
        <ul className="space-y-2">
          {rows.map((r) => {
            const months = overdueMonths(r.lines).map((l) => l.month)
            const msg = reminderMessage({ name: r.member.nameBn, due: r.due, months, dueDay: snap.settings.dueDay })
            return (
              <li key={r.member.id} className="rounded-xl border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/members/${r.member.id}`} className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {toBn(r.member.memberNo)}. {r.member.nameBn}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {toBn(months.length)} মাস: {months.map(monthLabel).join(", ")}
                    </p>
                  </Link>
                  <p className="shrink-0 text-lg font-bold text-destructive">{taka(r.due)}</p>
                </div>
                {r.missedStreak >= 3 ? (
                  <p className="mt-2 flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-900">
                    <AlertTriangle className="size-4" /> পরপর {toBn(r.missedStreak)} মাস বকেয়া — নিয়ম অনুযায়ী নোটিশ দিতে হবে
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={waLink(r.member.phone, msg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center gap-1 rounded-lg bg-[#25D366] text-base font-medium text-white"
                  >
                    <MessageCircle className="size-5" /> রিমাইন্ডার
                  </a>
                  <Link href={`/admin/pay?member=${r.member.id}`} className="flex h-11 items-center justify-center rounded-lg border text-base">
                    জমা নিন
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            {monthLabel(thisMonth)}-এর চাঁদা এখনো দেননি — {toBn(upcoming.length)} জন
          </p>
          <p className="text-2xl font-bold text-amber-800">{taka(upcomingTotal)}</p>
          <p className="text-xs text-amber-900/80">{toBn(snap.settings.dueDay)} তারিখ পর্যন্ত সময় আছে, তাই এখনো &quot;বকেয়া&quot; ধরা হয়নি।</p>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">এই মাসের চাঁদা সবাই দিয়ে দিয়েছেন। 🎉</p>
        ) : null}
        <WhatsappQueue
          verb="মনে করানো"
          items={upcoming.map((r) => ({
            id: r.member.id,
            label: `${toBn(r.member.memberNo)}. ${r.member.nameBn}`,
            hasPhone: !!r.member.phone,
            link: waLink(
              r.member.phone,
              upcomingReminderMessage({ name: r.member.nameBn, month: thisMonth, amount: r.currentOpen, dueDay: snap.settings.dueDay }),
            ),
          }))}
        />
        <ul className="space-y-2">
          {upcoming.map((r) => (
            <li key={r.member.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/members/${r.member.id}`} className="min-w-0 truncate text-base font-semibold">
                  {toBn(r.member.memberNo)}. {r.member.nameBn}
                </Link>
                <p className="shrink-0 text-lg font-bold text-amber-700">{taka(r.currentOpen)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={waLink(
                    r.member.phone,
                    upcomingReminderMessage({ name: r.member.nameBn, month: thisMonth, amount: r.currentOpen, dueDay: snap.settings.dueDay }),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-1 rounded-lg bg-[#25D366] text-base font-medium text-white"
                >
                  <MessageCircle className="size-5" /> মনে করিয়ে দিন
                </a>
                <Link href={`/admin/pay?member=${r.member.id}`} className="flex h-11 items-center justify-center rounded-lg border text-base">
                  জমা নিন
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
