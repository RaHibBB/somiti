import { PageTitle } from "@/components/layout/page-title"
import { PaymentOptions } from "@/components/payment-options"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { getSnapshot } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, taka } from "@/lib/format"
import { myReports } from "@/lib/services/payment-reports"
import { cn } from "@/lib/utils"
import { ReportForm } from "./report-form"

export const metadata = { title: "টাকা দিন — সমিতি" }

const STATUS = {
  pending: { label: "যাচাই বাকি", cls: "bg-amber-100 text-amber-900" },
  approved: { label: "✓ জমা হয়েছে", cls: "bg-green-100 text-green-800" },
  rejected: { label: "বাতিল", cls: "bg-red-100 text-red-800" },
} as const

export default async function ReportPage() {
  const me = await requireMember()
  const [snap, mine] = await Promise.all([getSnapshot(), myReports(getDb(), me.id)])
  const entry = snap.members.find((m) => m.member.id === me.id)!
  // Months already reported and waiting for an admin shouldn't be offered again.
  const waiting = new Set(mine.filter((r) => r.status === "pending").flatMap((r) => r.items.map((i) => i.forMonth)))
  const open = entry.lines
    .filter((l) => l.remaining > 0 && !waiting.has(l.month))
    .map((l) => ({ month: l.month, remaining: l.remaining, isDue: l.isDue }))
  return (
    <div className="space-y-5">
      <PageTitle>টাকা দিন</PageTitle>
      {entry.due > 0 || entry.currentOpen > 0 ? (
        <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-950">
          এখন দেওয়ার কথা: <b>{taka(entry.due + entry.currentOpen)}</b>
          {entry.due > 0 ? " (বকেয়াসহ)" : ""}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">১. এখানে টাকা পাঠান</h2>
        <p className="text-sm text-muted-foreground">বিকাশ অ্যাপে &quot;Send Money&quot; করুন, অথবা ব্যাংকে জমা/ট্রান্সফার করুন। নম্বরের পাশে &quot;কপি&quot; চাপলে কপি হয়ে যাবে।</p>
        <PaymentOptions />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">২. পাঠানোর পর এখানে জানান</h2>
        <ReportForm open={open} today={snap.today} />
      </section>

      {mine.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">আমার জানানো জমা</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {mine.map((r) => (
              <li key={r.id} className="space-y-1 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold">{taka(r.amount)}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-sm", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.items.map((i) => monthLabel(i.forMonth)).join(", ")} · {METHOD_LABELS[r.method]} · {r.trxId} · {formatDate(r.paidOn)}
                </p>
                {r.status === "rejected" ? <p className="text-sm text-destructive">কারণ: {r.rejectReason}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
