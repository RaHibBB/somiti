import Link from "@/components/link"
import { FileDown } from "lucide-react"
import type { MemberLedger } from "@/lib/data"
import type { PaymentPeople } from "@/lib/payment-people"
import { receiptGroups } from "@/lib/receipts"
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
  people,
}: {
  entry: MemberLedger
  sharePrice: number
  showUpcoming?: number
  /** Admins get a "বাতিল" button on each valid payment (a wrong entry is voided, never deleted). */
  canVoid?: boolean
  /** Admins only: who received, entered and (if voided) voided each payment, by payment id. */
  people?: Record<number, PaymentPeople>
}) {
  const { member, lines } = entry
  // Months already due, plus the next few upcoming ones.
  const firstFuture = lines.findIndex((l) => !l.isDue)
  const visible = firstFuture === -1 ? lines : lines.slice(0, firstFuture + showUpcoming)
  // Months paid together in one save are one receipt (one card, one PDF).
  const receipts = receiptGroups(entry.payments)
  const payCount = entry.payments.length

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
        <h2 className="text-lg font-semibold text-brand-navy">সব জমা ({toBn(receipts.length)}টি রসিদ)</h2>
        {payCount === 0 ? (
          <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কোনো জমা নেই</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {receipts.map((g) => {
              const p = g.rows[0]
              const several = g.rows.length > 1
              return (
                <li key={g.receiptNo} className={cn("px-3 py-2.5", g.allVoid && "bg-muted/60")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("font-mono text-base font-semibold", g.allVoid && "line-through")}>
                      {g.receiptNos.map(receiptLabel).join(", ")}
                    </span>
                    <span className={cn("text-base font-semibold", g.allVoid && "text-muted-foreground line-through")}>
                      {taka(g.allVoid ? g.rows.reduce((s, r) => s + r.amount, 0) : g.total)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {several ? `${toBn(g.rows.length)} মাস` : monthLabel(p.forMonth)} · {formatDate(p.paidOn)} · {METHOD_LABELS[p.method]}
                    {p.trxId ? ` · ${p.trxId}` : ""}
                  </p>
                  {several ? (
                    <ul className="mt-1 space-y-0.5 rounded-lg bg-muted/50 px-2 py-1 text-sm">
                      {g.rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2">
                          <span className={cn(r.status === "void" && "line-through")}>
                            {monthLabel(r.forMonth)} <span className="text-xs text-muted-foreground">({receiptLabel(r.receiptNo)})</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={cn(r.status === "void" && "text-muted-foreground line-through")}>{taka(r.amount)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {people?.[p.id] ? (
                    <p className="text-sm text-muted-foreground">
                      {[
                        people[p.id].received ? `টাকা নিয়েছেন: ${people[p.id].received}` : "টাকা কার কাছে: লেখা নেই",
                        people[p.id].entered ? `লিখেছেন: ${people[p.id].entered}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {g.rows
                    .filter((r) => r.status === "void")
                    .map((r) => (
                      <p key={r.id} className="text-sm font-medium text-destructive">
                        বাতিল{several ? ` (${monthLabel(r.forMonth)})` : ""}
                        {people?.[r.id]?.voided ? ` (${people[r.id].voided})` : ""} — {r.voidReason}
                      </p>
                    ))}
                  <Link href={`/print/receipt/${g.receiptNo}`} className="mt-1 inline-flex items-center gap-1 text-sm text-brand-navy underline">
                    <FileDown className="size-4" /> রসিদ PDF / WhatsApp
                  </Link>
                  {canVoid
                    ? g.rows
                        .filter((r) => r.status === "valid")
                        .map((r) => (
                          <div key={r.id} className="mt-1 flex justify-end">
                            <VoidButton
                              kind="payment"
                              id={r.id}
                              label={`${receiptLabel(r.receiptNo)} (${monthLabel(r.forMonth)}, ${taka(r.amount)})`}
                              buttonText={several ? `${monthLabel(r.forMonth)} ভুল হলে বাতিল` : undefined}
                            />
                          </div>
                        ))
                    : null}
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
