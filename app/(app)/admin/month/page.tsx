import Link from "next/link"
import { and, asc, desc, eq, gte, lt } from "drizzle-orm"
import { Check, ChevronRight, Circle } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { getDb } from "@/lib/db"
import { cashHandovers, monthCloseEvents, monthTasks, notices } from "@/lib/db/schema"
import { formatDateTime, monthLabel, taka, toBn } from "@/lib/format"
import { holderBalances } from "@/lib/holdings"
import { addMonths, monthOf } from "@/lib/ledger"
import { cn } from "@/lib/utils"
import { CloseControls, TickButton } from "./month-controls"

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

/** The month's work in order: what to do, what is already done, and closing the month. */
export default async function MonthPage({ searchParams }: PageProps<"/admin/month">) {
  await requireAdmin()
  const db = getDb()
  const snap = await getSnapshot()
  const current = monthOf(snap.today)
  const raw = (await searchParams).month
  const first = snap.settings.startMonth
  const month = typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw) && `${raw}-01` >= first && `${raw}-01` <= current ? `${raw}-01` : current
  const next = addMonths(month, 1)
  const label = monthLabel(month)

  const [monthNotices, tasks, events, handovers] = await Promise.all([
    db.select({ id: notices.id }).from(notices).where(and(eq(notices.status, "active"), gte(notices.createdAt, new Date(`${month}T00:00:00+06:00`)), lt(notices.createdAt, new Date(`${next}T00:00:00+06:00`)))),
    db.select().from(monthTasks).where(eq(monthTasks.month, month)),
    db.select().from(monthCloseEvents).where(eq(monthCloseEvents.month, month)).orderBy(desc(monthCloseEvents.id)),
    db.select().from(cashHandovers).orderBy(asc(cashHandovers.id)),
  ])
  const ticked = new Set(tasks.map((t) => t.key))
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

  const { holders, bankTotal } = holderBalances(
    snap.members.flatMap((m) => m.payments),
    handovers,
  )
  const holdingNow = holders.filter((h) => h.balance !== 0)

  const months: string[] = []
  for (let m = current; m >= first && months.length < 12; m = addMonths(m, -1)) months.push(m)

  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", on ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white")

  return (
    <div className="space-y-4">
      <PageTitle>মাসের কাজ</PageTitle>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {months.map((m) => (
          <Link key={m} href={`/admin/month?month=${m.slice(0, 7)}`} className={chip(m === month)}>
            {monthLabel(m)}
            {events.length === 0 && m === month ? "" : ""}
          </Link>
        ))}
      </div>

      <div className={cn("rounded-xl p-3", closed ? "bg-green-50 text-green-900" : "bg-secondary")}>
        <p className="text-sm">{label}</p>
        <p className="text-lg font-bold">
          {closed ? "হিসাব বন্ধ (চূড়ান্ত)" : "চলছে"} · আদায় {taka(paid)} / {taka(expected)}
        </p>
        {latest ? (
          <p className="text-xs">
            {latest.kind === "close" ? "বন্ধ করেছেন" : "খুলেছেন"}: {names.get(latest.byId) ?? "অ্যাডমিন"} · {formatDateTime(latest.createdAt)}
            {latest.kind === "reopen" && latest.reason ? ` — কারণ: ${latest.reason}` : ""}
          </p>
        ) : null}
      </div>

      <ol className="space-y-3">
        <Step n={1} done={monthNotices.length > 0 || ticked.has("notice")} title="মাসের নোটিশ দিন">
          <p className="text-sm text-muted-foreground">
            {monthNotices.length > 0 ? `${toBn(monthNotices.length)}টি নোটিশ দেওয়া হয়েছে।` : "এ মাসে এখনো নোটিশ দেওয়া হয়নি (চাঁদার তারিখ মনে করিয়ে দিতে পারেন)।"}
          </p>
          <Link href="/admin/notices" className={linkBtn}>
            নোটিশ লিখুন <ChevronRight className="size-5" />
          </Link>
          {monthNotices.length === 0 ? <TickButton month={month} taskKey="notice" done={ticked.has("notice")} /> : null}
        </Step>

        <Step n={2} done={allPaid} title="চাঁদা জমা নিন">
          <p className="text-sm text-muted-foreground">
            {allPaid ? "সবাই এ মাসের চাঁদা দিয়েছেন।" : `${toBn(unpaidCount)} জনের এ মাসের চাঁদা বাকি।`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/admin/pay" className={linkBtn}>
              জমা নিন <ChevronRight className="size-5" />
            </Link>
            <Link href="/admin/pay/bulk" className={linkBtn}>
              একসাথে অনেকের জমা <ChevronRight className="size-5" />
            </Link>
          </div>
        </Step>

        <Step n={3} done={ticked.has("reminders") || (overdueCount === 0 && unpaidCount === 0)} title="বকেয়ার তাগিদ দিন">
          <p className="text-sm text-muted-foreground">
            মেয়াদ-পেরোনো বকেয়া {toBn(overdueCount)} জন, এ মাসের বাকি {toBn(unpaidCount)} জন।
          </p>
          <Link href="/admin/dues" className={linkBtn}>
            তাগিদ পাঠান (একে একে WhatsApp) <ChevronRight className="size-5" />
          </Link>
          <TickButton month={month} taskKey="reminders" done={ticked.has("reminders")} />
        </Step>

        <Step n={4} done={ticked.has("handover")} title="কার হাতে কত টাকা — মিলিয়ে নিন">
          {holdingNow.length === 0 ? (
            <p className="text-sm text-muted-foreground">কারো হাতে টাকা বাকি নেই।</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-white text-sm">
              {holdingNow.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2">
                  <span>{names.get(h.id) ?? "অজানা"}</span>
                  <b>{taka(h.balance)}</b>
                </li>
              ))}
            </ul>
          )}
          {bankTotal > 0 ? <p className="text-sm text-muted-foreground">ব্যাংকে জমা হয়েছে মোট {taka(bankTotal)}।</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/admin/handover" className={linkBtn}>
              টাকা হস্তান্তর / ব্যাংকে জমা <ChevronRight className="size-5" />
            </Link>
            <Link href="/admin/holdings" className={linkBtn}>
              কার কাছে কত (বিস্তারিত) <ChevronRight className="size-5" />
            </Link>
          </div>
          <TickButton month={month} taskKey="handover" done={ticked.has("handover")} />
        </Step>

        <Step n={5} done={ticked.has("group_message")} title="গ্রুপে মাসের হিসাব পাঠান">
          <p className="text-sm text-muted-foreground">হোম পাতার সবুজ বাটন &quot;মাসিক হিসাব WhatsApp গ্রুপে পাঠান&quot; চাপলে মেসেজ তৈরি হয়ে খুলবে।</p>
          <Link href="/" className={linkBtn}>
            হোম পাতায় যান <ChevronRight className="size-5" />
          </Link>
          <TickButton month={month} taskKey="group_message" done={ticked.has("group_message")} />
        </Step>

        <Step n={6} done={ticked.has("report")} title="মাসিক রিপোর্ট PDF সংরক্ষণ করুন">
          <Link href={`/print/month/${month.slice(0, 7)}`} className={linkBtn}>
            {label}-এর রিপোর্ট (PDF) <ChevronRight className="size-5" />
          </Link>
          <TickButton month={month} taskKey="report" done={ticked.has("report")} />
        </Step>

        <Step n={7} done={closed} title="মাসের হিসাব বন্ধ করুন">
          {!closed ? (
            <p className="text-sm text-muted-foreground">
              {unpaidCount > 0 ? `এখনো ${toBn(unpaidCount)} জনের টাকা বাকি — চাইলে তবুও বন্ধ করা যায়, বাকিটা বকেয়া হিসেবে থাকবে। ` : ""}
              বন্ধ করলে এই মাসের তারিখে আর নতুন জমা বা বাতিল করা যাবে না, তাই সব শেষ হলে বন্ধ করুন।
            </p>
          ) : null}
          <CloseControls month={month} closed={closed} label={label} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Circle className="size-3" /> কারণ লিখে খুললে সেটা অডিট লগে থাকে।
          </p>
        </Step>
      </ol>
    </div>
  )
}
