import Link from "next/link"
import { FileDown, ImageIcon, Plus } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireMember } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { loadFund, loadTransactions } from "@/lib/data"
import { formatDate, taka, TXN_TYPE_LABELS } from "@/lib/format"
import type { TxnType } from "@/lib/ledger"
import { cn } from "@/lib/utils"

export const metadata = { title: "আয়-ব্যয় — সমিতি" }

const INFLOW: TxnType[] = ["business_income", "investment_return", "bank_profit"]

export default async function TransactionsPage() {
  const me = await requireMember()
  const adminUi = await showAdminUi(me)
  const [rows, fund] = await Promise.all([loadTransactions(), loadFund()])
  return (
    <div className="space-y-4">
      <PageTitle
        action={
          adminUi ? (
            <Link href="/admin/transactions/new" className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-base text-white">
              <Plus className="size-5" /> যোগ
            </Link>
          ) : null
        }
      >
        আয়-ব্যয় ও বিনিয়োগ
      </PageTitle>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        {(Object.keys(TXN_TYPE_LABELS) as TxnType[]).map((t) => (
          <div key={t} className="rounded-lg border bg-white px-3 py-2">
            <dt className="text-muted-foreground">{TXN_TYPE_LABELS[t]}</dt>
            <dd className="text-base font-semibold">{taka(fund.byType[t])}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/print/transactions"
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-navy bg-white text-base font-semibold text-brand-navy"
      >
        <FileDown className="size-5" /> PDF ডাউনলোড
      </Link>

      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {rows.map((t) => {
          const isVoid = t.status === "void"
          const inflow = INFLOW.includes(t.type)
          return (
            <li key={t.id} className={cn("flex gap-3 px-3 py-3", isVoid && "bg-muted/60")}>
              {t.receiptUrl ? (
                <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.receiptUrl} alt="রসিদ" loading="lazy" className="size-14 rounded-lg border object-cover" />
                </a>
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ImageIcon className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {TXN_TYPE_LABELS[t.type]} · {formatDate(t.date)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-base font-semibold",
                      isVoid ? "text-muted-foreground line-through" : inflow ? "text-green-700" : "text-foreground",
                    )}
                  >
                    {inflow ? "+" : "−"}
                    {taka(t.amount)}
                  </span>
                </div>
                <p className={cn("text-base", isVoid && "line-through")}>{t.description}</p>
                {t.approvedBy || t.meetingDate ? (
                  <p className="text-xs text-muted-foreground">
                    {t.approvedBy ? `অনুমোদন: ${t.approvedBy}` : ""}
                    {t.meetingDate ? ` · সভা ${formatDate(t.meetingDate)}` : ""}
                    {t.voteResult ? ` · ভোট: ${t.voteResult}` : ""}
                  </p>
                ) : null}
                {isVoid ? <p className="text-sm font-medium text-destructive">বাতিল — {t.voidReason}</p> : null}
              </div>
            </li>
          )
        })}
        {rows.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">এখনো কোনো লেনদেন নেই</li> : null}
      </ul>
    </div>
  )
}
