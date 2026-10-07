import Link from "next/link"
import { FileDown } from "lucide-react"
import type { MemberLedger } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MonthStatus } from "@/lib/ledger"
import { VoidButton } from "@/app/(app)/admin/void/void-button"

export const STATUS_LABEL: Record<MonthStatus, string> = {
  paid: "পরিশোধিত",
  partial: "আংশিক",
  unpaid: "বকেয়া",
  not_yet_due: "সময় হয়নি",
}

export const STATUS_CLASS: Record<MonthStatus, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-900",
  unpaid: "bg-red-100 text-red-800",
  not_yet_due: "bg-gray-100 text-gray-600",
}

export function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" | "good" }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-bold",
          tone === "danger" && "text-destructive",
          tone === "good" && "text-green-700",
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** Month-by-month list and every payment, shared by /me and /members/[id]. */
export function MemberStatement({
  entry,
  sharePrice,
  showUpcoming = 3,
  canVoid = false,
}: {
  entry: MemberLedger
  sharePrice: number
  showUpcoming?: number
  /** Admins get a "বাতিল" button on each valid payment (a wrong entry is voided, never deleted). */
  canVoid?: boolean
}) {
  const { member, lines } = entry
  // Months already due, plus the next few upcoming ones.
  const firstFuture = lines.findIndex((l) => !l.isDue)
  const visible = firstFuture === -1 ? lines : lines.slice(0, firstFuture + showUpcoming)
  const pays = [...entry.payments].sort((a, b) => b.receiptNo - a.receiptNo)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="শেয়ার" value={`${toBn(entry.sharesNow)} টি (মাসে ${taka(entry.sharesNow * sharePrice)})`} />
        <StatCard label="মোট জমা" value={taka(entry.paid)} tone="good" />
        <StatCard label="এ পর্যন্ত দেয়" value={taka(entry.expected)} />
        <StatCard label="বকেয়া" value={taka(entry.due)} tone={entry.due > 0 ? "danger" : undefined} />
      </div>

      <Link
        href={`/print/member/${member.id}`}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-navy bg-white text-base font-semibold text-brand-navy"
      >
        <FileDown className="size-5" /> PDF ডাউনলোড
      </Link>

      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">মাসভিত্তিক হিসাব</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {visible.map((l) => (
            <li key={l.month} className="flex items-center gap-2 px-3 py-2.5">
              <span className="flex-1 text-base">{monthLabel(l.month)}</span>
              <span className="text-sm text-muted-foreground">
                {taka(l.paid)} / {taka(l.expected)}
              </span>
              <span className={cn("w-20 rounded-md px-2 py-0.5 text-center text-sm", STATUS_CLASS[l.status])}>
                {STATUS_LABEL[l.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">সব জমা ({toBn(pays.length)})</h2>
        {pays.length === 0 ? (
          <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কোনো জমা নেই</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {pays.map((p) => {
              const isVoid = p.status === "void"
              return (
                <li key={p.id} className={cn("px-3 py-2.5", isVoid && "bg-muted/60")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("font-mono text-base font-semibold", isVoid && "line-through")}>
                      {receiptLabel(p.receiptNo)}
                    </span>
                    <span className={cn("text-base font-semibold", isVoid && "text-muted-foreground line-through")}>
                      {taka(p.amount)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {monthLabel(p.forMonth)} · {formatDate(p.paidOn)} · {METHOD_LABELS[p.method]}
                    {p.trxId ? ` · ${p.trxId}` : ""}
                  </p>
                  {isVoid ? <p className="text-sm font-medium text-destructive">বাতিল — {p.voidReason}</p> : null}
                  <Link href={`/print/receipt/${p.receiptNo}`} className="mt-1 inline-flex items-center gap-1 text-sm text-brand-navy underline">
                    <FileDown className="size-4" /> রসিদ PDF
                  </Link>
                  {canVoid && !isVoid ? (
                    <div className="mt-1 flex justify-end">
                      <VoidButton kind="payment" id={p.id} label={`${receiptLabel(p.receiptNo)} (${monthLabel(p.forMonth)}, ${taka(p.amount)})`} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      </div>
    </div>
  )
}
