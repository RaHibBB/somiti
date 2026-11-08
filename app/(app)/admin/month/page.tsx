import Link from "@/components/link"
import { asc, desc, eq } from "drizzle-orm"
import { Check, ChevronRight } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot, loadFund, loadTransactions } from "@/lib/data"
import { appUrl } from "@/lib/app-url"
import { monthlyGroupMessage } from "@/lib/whatsapp"
import { getGroupUrl } from "@/lib/group"
import { getBank } from "@/lib/bank"
import { payLine } from "@/lib/payment-info"
import { GroupShare } from "@/components/group-share"
import { getDb } from "@/lib/db"
import { cashHandovers, monthCloseEvents } from "@/lib/db/schema"
import { formatDateTime, monthLabel, taka, toBn } from "@/lib/format"
import { monthHoldings } from "@/lib/holdings"
import { addMonths, monthOf } from "@/lib/ledger"
import { cn } from "@/lib/utils"
import { CloseControls } from "./month-controls"

export const metadata = { title: "মাসের কাজ — সমিতি" }

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className={cn("rounded-2xl border bg-white p-4", done && "border-green-300 bg-green-50/40")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-green-600 text-white" : "bg-secondary text-brand-navy")}>
          {done ? <Check className="size-5" /> : toBn(n)}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          {children}
        </div>
      </div>
    </li>
  )
}

const linkBtn = "flex h-11 items-center justify-between rounded-lg border bg-white px-3 text-base active:bg-muted"

/** Five steps: collect, remind, bank, group summary, close. Closing is optional — it just locks the month once everything is final. */
export default async function MonthPage({ searchParams }: PageProps<"/admin/month">) {
  await requireAdmin()
  const db = getDb()
  const snap = await getSnapshot()
  const current = monthOf(snap.today)
  const raw = (await searchParams).month
  const first = snap.settings.startMonth
  const month = typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw) && `${raw}-01` >= first && `${raw}-01` <= current ? `${raw}-01` : current
  const label = monthLabel(month)

  const [events, handovers, txns, fund, base] = await Promise.all([
    db.select().from(monthCloseEvents).where(eq(monthCloseEvents.month, month)).orderBy(desc(monthCloseEvents.id)),
    db.select().from(cashHandovers).orderBy(asc(cashHandovers.id)),
    loadTransactions(db),
    loadFund(db),
    appUrl(),
  ])
  const latest = events[0]
  const closed = latest?.kind === "close"
  const names = new Map(snap.members.map((m) => [m.member.id, m.member.nameBn]))

  const active = snap.members.filter((m) => m.member.status === "active")
  const lines = active.map((m) => m.lines.find((l) => l.month === month)).filter((l) => l !== undefined)
  const expected = lines.reduce((s, l) => s + l.expected, 0)
  const paid = lines.reduce((s, l) => s + Math.min(l.paid, l.expected), 0)
  const unpaidCount = lines.filter((l) => l.remaining > 0).length
  const overdueCount = active.filter((m) => m.due > 0).length
  const allPaid = expected > 0 && unpaidCount === 0

  const hold = monthHoldings(
    snap.members.flatMap((m) => m.payments),
    handovers,
    month,
    txns,
  )
  const holdingNow = hold.holders.filter((h) => h.closing !== 0)

  // One tap: the month's summary for the WhatsApp group (who paid, who owes, bank, fund).
  const groupMsg = monthlyGroupMessage({
    month,
    paidCount: lines.filter((l) => l.status === "paid").length,
    activeCount: active.length,
    collected: paid,
    expected,
    owing: active
      .filter((m) => m.due > 0)
      .sort((a, b) => b.due - a.due)
      .map((m) => ({ no: m.member.memberNo, name: m.member.nameBn, due: m.due })),
    notYet: active
      .filter((m) => m.due === 0 && (m.lines.find((l) => l.month === month)?.remaining ?? 0) > 0)
      .map((m) => ({ no: m.member.memberNo, name: m.member.nameBn })),
    fundTotal: fund.total,
    cash: fund.cash,
    invested: fund.invested,
    banked: { toBank: hold.toBank, inHand: hold.inHand },
    pay: payLine(getBank()),
    reportUrl: `${base}/print/month/${month.slice(0, 7)}`,
  })

  const months: string[] = []
  for (let m = current; m >= first && months.length < 12; m = addMonths(m, -1)) months.push(m)
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", on ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white")

  return (
    <div className="space-y-4">
      <PageTitle>মাসের কাজ</PageTitle>
      {months.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.map((m) => (
            <Link key={m} href={`/admin/month?month=${m.slice(0, 7)}`} className={chip(m === month)}>
              {monthLabel(m)}
            </Link>
          ))}
        </div>
      ) : null}

      <div className={cn("rounded-xl p-3", closed ? "bg-green-50 text-green-900" : "bg-secondary")}>
        <p className="text-sm">{label}</p>
        <p className="text-lg font-bold">
          {closed ? "হিসাব বন্ধ" : "চলছে"} · আদায় {taka(paid)} / {taka(expected)}
        </p>
        {latest ? (
          <p className="text-xs">
            {latest.kind === "close" ? "বন্ধ করেছেন" : "খুলেছেন"}: {names.get(latest.byId) ?? "অ্যাডমিন"} · {formatDateTime(latest.createdAt)}
          </p>
        ) : null}
      </div>

      <ol className="space-y-3">
        <Step n={1} done={allPaid} title="চাঁদা জমা নিন">
          <p className="text-sm text-muted-foreground">{allPaid ? "সবাই দিয়েছেন।" : `${toBn(unpaidCount)} জনের চাঁদা বাকি।`}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/admin/pay" className={linkBtn}>
              জমা নিন <ChevronRight className="size-5" />
            </Link>
            <Link href="/admin/pay/bulk" className={linkBtn}>
              একসাথে অনেকের জমা <ChevronRight className="size-5" />
            </Link>
          </div>
        </Step>

        <Step n={2} done={overdueCount === 0 && unpaidCount === 0} title="বাকি থাকলে তাগিদ দিন">
          <p className="text-sm text-muted-foreground">
            মেয়াদ-পেরোনো বকেয়া {toBn(overdueCount)} জন · এ মাসের বাকি {toBn(unpaidCount)} জন
          </p>
          <Link href="/admin/dues" className={linkBtn}>
            তাগিদ পাঠান (একে একে WhatsApp) <ChevronRight className="size-5" />
          </Link>
        </Step>

        <Step n={3} done={hold.collected > 0 && hold.inHand === 0} title="টাকা ব্যাংকে জমা দিন">
          <p className="text-sm text-muted-foreground">
            এ মাসে আদায় {taka(hold.collected)} · ব্যাংকে {taka(hold.toBank)} · হাতে {taka(hold.inHand)}
          </p>
          {holdingNow.length > 0 ? (
            <ul className="divide-y rounded-lg border bg-white text-sm">
              {holdingNow.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2">
                  <span>{names.get(h.id) ?? "অজানা"}-এর হাতে</span>
                  <b>{taka(h.closing)}</b>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href={`/admin/holdings?month=${month.slice(0, 7)}`} className={linkBtn}>
            কার কাছে কত টাকা — ব্যাংকে জমা লিখুন <ChevronRight className="size-5" />
          </Link>
        </Step>

        <Step n={4} done={false} title="গ্রুপে মাসের হিসাব পাঠান">
          <p className="text-sm text-muted-foreground">কতজন দিলেন, কে বাকি, ব্যাংকে কত, তহবিল কত — মেসেজ তৈরি থাকবে।</p>
          <GroupShare text={groupMsg} groupUrl={getGroupUrl()} label="মাসিক হিসাব WhatsApp গ্রুপে পাঠান" />
        </Step>

        <Step n={5} done={closed} title="সব ঠিক থাকলে মাস বন্ধ করুন (ঐচ্ছিক)">
          {!closed && hold.inHand > 0 ? <p className="text-sm text-amber-800">এখনো {taka(hold.inHand)} কারো হাতে আছে — চাইলে তবুও বন্ধ করা যায়, টাকাটা পরের মাসে &quot;আগের মাস থেকে&quot; হিসেবে থাকবে।</p> : null}
          <CloseControls month={month} closed={closed} label={label} />
        </Step>
      </ol>
    </div>
  )
}
