import { PageTitle } from "@/components/layout/page-title"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { getSnapshot } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, taka } from "@/lib/format"
import { myReports } from "@/lib/services/payment-reports"
import { cn } from "@/lib/utils"
import { ReportForm } from "./report-form"

export const metadata = { title: "বিকাশ/নগদে জমা জানান — সমিতি" }

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
      <PageTitle>বিকাশ/নগদে জমা জানান</PageTitle>
      <ReportForm open={open} today={snap.today} />

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
