import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { formatDate, formatDateTime, METHOD_LABELS, monthLabel, taka, toBn } from "@/lib/format"
import { pendingReports } from "@/lib/services/payment-reports"
import { ReviewButtons } from "./review-buttons"

export const metadata = { title: "জানানো জমা যাচাই — সমিতি" }

export default async function ReportsPage() {
  await requireAdmin()
  const rows = await pendingReports(getDb())
  return (
    <div className="space-y-4">
      <PageTitle>জানানো জমা যাচাই</PageTitle>
      <p className="text-sm text-muted-foreground">
        সদস্যরা বিকাশ/নগদে পাঠিয়ে এখানে জানিয়েছেন। সমিতির বিকাশ/নগদ অ্যাপে ট্রানজেকশন আইডি ও টাকা মিলিয়ে দেখুন, তারপর অনুমোদন দিন। অনুমোদনেই জমা ও রসিদ তৈরি হবে।
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">যাচাই করার মতো কিছু নেই।</p>
      ) : null}
      <ul className="space-y-3">
        {rows.map(({ r, name, no }) => (
          <li key={r.id} className="space-y-3 rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {toBn(no)}. {name}
                </p>
                <p className="text-sm text-muted-foreground">জানিয়েছেন {formatDateTime(r.createdAt)}</p>
              </div>
              <p className="shrink-0 text-xl font-bold text-brand-navy">{taka(r.amount)}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
              <dt className="text-muted-foreground">মাধ্যম</dt>
              <dd>{METHOD_LABELS[r.method]}</dd>
              <dt className="text-muted-foreground">TrxID</dt>
              <dd className="font-mono font-semibold tracking-wide">{r.trxId}</dd>
              <dt className="text-muted-foreground">তারিখ</dt>
              <dd>{formatDate(r.paidOn)}</dd>
              <dt className="text-muted-foreground">মাস</dt>
              <dd>{r.items.map((i) => `${monthLabel(i.forMonth)} (${taka(i.amount)})`).join(", ")}</dd>
              {r.note ? (
                <>
                  <dt className="text-muted-foreground">নোট</dt>
                  <dd>{r.note}</dd>
                </>
              ) : null}
            </dl>
            <ReviewButtons id={r.id} name={name} />
          </li>
        ))}
      </ul>
    </div>
  )
}
