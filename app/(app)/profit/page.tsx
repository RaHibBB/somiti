import Link from "next/link"
import { desc } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { profitDistributions } from "@/lib/db/schema"
import { loadSettings } from "@/lib/data"
import { formatDate, monthLabel, taka, toBn, todayDhaka } from "@/lib/format"
import { monthDiff, monthOf } from "@/lib/ledger"
import { samitiYear } from "@/lib/profit"
import { previewDistribution, type DistributionDetails } from "@/lib/services/profit"
import { cn } from "@/lib/utils"
import { SaveDistributionForm, VoidDistributionForm } from "./profit-forms"

export const metadata = { title: "মুনাফা বণ্টন — সমিতি" }

export default async function ProfitPage({ searchParams }: PageProps<"/profit">) {
  const me = await requireMember()
  const db = getDb()
  const today = todayDhaka()
  const settings = await loadSettings(db)
  const yearsSoFar = Math.max(1, Math.floor(monthDiff(settings.startMonth, monthOf(today)) / 12) + 1)
  const requested = Number((await searchParams).year)
  const year = Number.isInteger(requested) && requested >= 0 && requested < yearsSoFar ? requested : yearsSoFar - 1
  const saved = await db.select().from(profitDistributions).orderBy(desc(profitDistributions.periodStart), desc(profitDistributions.id))
  const preview = me.role === "admin" ? await previewDistribution(db, year) : null
  const yearEnd = samitiYear(settings.startMonth, year).periodEnd
  const yearFinished = monthOf(today) > yearEnd

  return (
    <div className="space-y-5">
      <PageTitle>বার্ষিক মুনাফা বণ্টন</PageTitle>
      <p className="text-sm text-muted-foreground">
        নিয়ম: বছরের মুনাফার {toBn(settings.reservePct)}% সংরক্ষিত তহবিলে যায়, বাকি অংশ সদস্যদের শেয়ারের অনুপাতে বণ্টন হয়।
      </p>

      {preview ? (
        <section className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">হিসাব করুন (অ্যাডমিন)</h2>
          <div className="flex gap-2 overflow-x-auto">
            {Array.from({ length: yearsSoFar }, (_, i) => {
              const y = samitiYear(settings.startMonth, i)
              return (
                <Link
                  key={i}
                  href={`/profit?year=${i}`}
                  className={cn(
                    "shrink-0 rounded-lg border-2 px-3 py-2 text-sm",
                    i === year ? "border-brand-navy bg-brand-navy text-white" : "bg-white",
                  )}
                >
                  {monthLabel(y.periodStart)} – {monthLabel(y.periodEnd)}
                </Link>
              )
            })}
          </div>
          {!yearFinished ? (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">এই বছর এখনো শেষ হয়নি — এটি আজ পর্যন্ত হিসাবের একটি আনুমানিক চিত্র।</p>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-base">
            <dt className="text-muted-foreground">আয় (ব্যবসা + ব্যাংক)</dt>
            <dd className="text-right">{taka(preview.income)}</dd>
            <dt className="text-muted-foreground">খরচ</dt>
            <dd className="text-right">− {taka(preview.expense)}</dd>
            <dt className="font-semibold">মুনাফা</dt>
            <dd className={cn("text-right font-semibold", preview.profit < 0 && "text-destructive")}>{taka(preview.profit)}</dd>
            <dt className="text-muted-foreground">সংরক্ষিত তহবিলে</dt>
            <dd className="text-right">{taka(preview.reserveAmount)}</dd>
            <dt className="text-muted-foreground">সদস্যদের মধ্যে বণ্টন</dt>
            <dd className="text-right font-semibold text-green-700">{taka(preview.distributedAmount)}</dd>
          </dl>
          {preview.roundingToReserve > 0 ? (
            <p className="text-xs text-muted-foreground">ভাগের পর অবশিষ্ট {taka(preview.roundingToReserve)} সংরক্ষিত তহবিলে যোগ হয়েছে।</p>
          ) : null}
          {preview.profit > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1">সদস্য</th>
                      <th className="py-1 text-right">শেয়ার-মাস</th>
                      <th className="py-1 text-right">লভ্যাংশ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr key={l.memberId} className="border-b last:border-0">
                        <td className="py-1">
                          {toBn(l.memberNo)}. {l.name}
                        </td>
                        <td className="py-1 text-right">{toBn(l.shareMonths)}</td>
                        <td className="py-1 text-right">{taka(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                শেয়ার-মাস = বছরের প্রতি মাসে ধারণকৃত শেয়ারের যোগফল (বছরের মাঝে শেয়ার বদলালে ন্যায্য ভাগ)। শুধু সক্রিয় সদস্যরা পান।
              </p>
              <SaveDistributionForm year={year} distributed={preview.distributedAmount} today={today} />
            </>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">সংরক্ষিত বণ্টন</h2>
        {saved.map((d) => {
          const details = d.details as DistributionDetails | null
          const myLine = details?.lines.find((l) => l.memberId === me.id)
          const isVoid = d.status === "void"
          return (
            <article key={d.id} className={cn("space-y-2 rounded-xl border bg-white p-4", isVoid && "bg-muted opacity-75")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("text-base font-semibold", isVoid && "line-through")}>{d.periodLabel}</p>
                  <p className="text-xs text-muted-foreground">সংরক্ষণ: {formatDate(d.createdAt)}</p>
                </div>
                {me.role === "admin" && !isVoid ? <VoidDistributionForm id={d.id} /> : null}
              </div>
              {isVoid ? <p className="text-sm text-destructive">বাতিল — {d.voidReason}</p> : null}
              <p className="text-base">
                মুনাফা {taka(d.totalProfit)} · সংরক্ষিত {taka(d.reserveAmount)} · বণ্টন {taka(d.distributedAmount)}
              </p>
              {myLine ? (
                <p className="rounded-lg bg-green-50 p-2 text-base text-green-900">আপনার লভ্যাংশ: {taka(myLine.amount)}</p>
              ) : null}
              {details?.lines.length ? (
                <details>
                  <summary className="cursor-pointer text-sm text-brand-navy">সবার ভাগ দেখুন</summary>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {details.lines.map((l) => (
                      <li key={l.memberId} className="flex justify-between">
                        <span>
                          {toBn(l.memberNo)}. {l.name}
                        </span>
                        <span>{taka(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          )
        })}
        {saved.length === 0 ? <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কোনো বণ্টন সংরক্ষণ হয়নি</p> : null}
      </section>
    </div>
  )
}
