import Link from "next/link"
import { AlertTriangle, MessageCircle } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { monthLabel, taka, toBn } from "@/lib/format"
import { overdueMonths } from "@/lib/ledger"
import { reminderMessage, waLink } from "@/lib/whatsapp"

export default async function DuesPage() {
  await requireAdmin()
  const snap = await getSnapshot()
  const rows = snap.members
    .filter((m) => m.member.status === "active" && m.due > 0)
    .sort((a, b) => b.due - a.due)
  const total = rows.reduce((s, r) => s + r.due, 0)

  return (
    <div className="space-y-4">
      <PageTitle>বকেয়া</PageTitle>
      <div className="rounded-xl bg-secondary p-3">
        <p className="text-sm text-muted-foreground">{toBn(rows.length)} জন সদস্যের মোট বকেয়া</p>
        <p className="text-2xl font-bold text-destructive">{taka(total)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">কারো কোনো বকেয়া নেই। 🎉</p>
      ) : null}
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
                <Link
                  href={`/admin/pay?member=${r.member.id}`}
                  className="flex h-11 items-center justify-center rounded-lg border text-base"
                >
                  জমা নিন
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
