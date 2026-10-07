import Link from "next/link"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { InstallHint } from "@/components/install-hint"
import { Logo } from "@/components/logo"
import { STATUS_CLASS, STATUS_LABEL, StatCard } from "@/components/member-statement"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { getSnapshot, loadFund, loadLatestNotices } from "@/lib/data"
import { getDb } from "@/lib/db"
import { paymentReports, proposals, votes } from "@/lib/db/schema"
import { closeExpiredProposals } from "@/lib/services/proposals"
import { after } from "next/server"
import { and, count, eq, gt, isNull, notExists, or } from "drizzle-orm"
import { CalendarClock, HandCoins, LogIn, MessageCircle, Plus, Smartphone, UserPlus, Users, Vote } from "lucide-react"
import { appUrl } from "@/lib/app-url"
import { monthlyGroupMessage, waLink } from "@/lib/whatsapp"
import { dateLongBn, formatDate, monthLabel, taka, toBn } from "@/lib/format"
import { dueReminder, monthOf } from "@/lib/ledger"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const db = getDb()
  // Closing overdue votes is housekeeping: do it after the page is sent, not before.
  after(() => closeExpiredProposals(db))
  const now = new Date()
  const [snap, fund, notices, pendingVotes, [{ n: pendingReportCount }]] = await Promise.all([
    getSnapshot(),
    loadFund(),
    loadLatestNotices(3),
    db
      .select({ id: proposals.id, title: proposals.title })
      .from(proposals)
      .where(
        me
          ? and(
              eq(proposals.status, "open"),
              or(isNull(proposals.closesAt), gt(proposals.closesAt, now)),
              notExists(
                db
                  .select({ one: votes.id })
                  .from(votes)
                  .where(and(eq(votes.proposalId, proposals.id), eq(votes.memberId, me.id))),
              ),
            )
          : and(eq(proposals.status, "open"), or(isNull(proposals.closesAt), gt(proposals.closesAt, now))),
      ),
    db.select({ n: count() }).from(paymentReports).where(eq(paymentReports.status, "pending")),
  ])
  // Visitors (not logged in) see everything except a personal "my account" section.
  const entry = me ? snap.members.find((m) => m.member.id === me.id) : undefined
  const thisMonth = monthOf(snap.today)
  const reminder = entry ? dueReminder(entry.lines, snap.today, snap.settings.dueDay) : null
  // Admin summary: this month's collection and today's receipts (for handing over cash).
  const active = snap.members.filter((m) => m.member.status === "active")
  const monthLines = active.map((m) => m.lines.find((l) => l.month === thisMonth)).filter((l) => l !== undefined)
  const monthExpected = monthLines.reduce((s, l) => s + l.expected, 0)
  const monthPaid = monthLines.reduce((s, l) => s + Math.min(l.paid, l.expected), 0)
  const paidCount = monthLines.filter((l) => l.status === "paid").length
  const owingCount = active.filter((m) => m.due > 0).length
  // Everyone with something still to pay: overdue, or this month not yet fully paid.
  const pendingCount = active.filter((m) => m.due > 0 || m.currentOpen > 0).length
  const todays = snap.members.flatMap((m) => m.payments).filter((p) => p.status === "valid" && p.paidOn === snap.today)
  const todayTotal = todays.reduce((s, p) => s + p.amount, 0)
  const groupMsg = adminUi
    ? monthlyGroupMessage({
        month: thisMonth,
        paidCount,
        activeCount: active.length,
        collected: monthPaid,
        expected: monthExpected,
        owing: active
          .filter((m) => m.due > 0)
          .sort((a, b) => b.due - a.due)
          .map((m) => ({ no: m.member.memberNo, name: m.member.nameBn, due: m.due })),
        notYet: active.filter((m) => m.due === 0 && m.currentOpen > 0).map((m) => ({ no: m.member.memberNo, name: m.member.nameBn })),
        fundTotal: fund.total,
        cash: fund.cash,
        invested: fund.invested,
        reportUrl: `${await appUrl()}/print/month/${thisMonth.slice(0, 7)}`,
      })
    : ""
  const current = entry?.lines.find((l) => l.month === thisMonth)
  const investedPct = fund.total > 0 ? 100 - fund.cashPct : 0

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
      {/* Hero: Bismillah, logo, greeting, today's date and three key numbers (open to everyone). */}
      <section className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-[#1d3f57] to-[#12303f] px-4 pt-5 pb-6 text-white lg:col-span-2 lg:mx-0 lg:mt-0 lg:rounded-3xl lg:px-8 lg:pt-6 lg:pb-7">
        {/* Pattern on its own layer: it can't share `background-image` with the gradient. */}
        <div aria-hidden className="pattern-star pointer-events-none absolute inset-0" />
        <p className="relative font-arabic text-center text-[1.7rem] leading-[1.9] text-amber-100" lang="ar" dir="rtl">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
        <div className="relative mt-3 flex items-center gap-3">
          <div className="shrink-0 rounded-2xl bg-white/95 p-1.5 shadow-md">
            <Logo size={52} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white/75">{me ? "আসসালামু আলাইকুম" : "স্বাগতম"}</p>
            <p className="truncate text-xl leading-tight font-bold">{me ? me.nameBn : "সমিতির সব হিসাব সবার জন্য খোলা"}</p>
            <p className="mt-0.5 text-xs text-white/70">{dateLongBn(snap.today)}</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 px-1 py-2.5 backdrop-blur-sm">
            <p className="text-[0.7rem] text-white/70">সক্রিয় সদস্য</p>
            <p className="text-lg font-bold">{toBn(active.length)} জন</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-1 py-2.5 backdrop-blur-sm">
            <p className="text-[0.7rem] text-white/70">মোট তহবিল</p>
            <p className="text-lg font-bold">{taka(fund.total)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-1 py-2.5 backdrop-blur-sm">
            <p className="text-[0.7rem] text-white/70">এ মাসে আদায়</p>
            <p className="text-lg font-bold">{toBn(monthExpected ? Math.round((monthPaid * 100) / monthExpected) : 0)}%</p>
          </div>
        </div>
        {!me ? (
          <Link
            href="/login"
            className="relative mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-brand-navy active:opacity-90"
          >
            <LogIn className="size-5" /> লগইন — নিজের হিসাব, জমা জানানো ও ভোট
          </Link>
        ) : null}
      </section>
      <InstallHint />
      {!me ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-center text-sm text-muted-foreground lg:col-span-2">
          কে কত দিয়েছেন, বকেয়া, তহবিল, আয়-ব্যয় — সব এখানে দেখা যায়। দেখতে লগইন লাগে না।
        </p>
      ) : null}

      {adminUi ? (
        <div className="grid grid-cols-2 gap-2 lg:col-span-2 lg:grid-cols-4 lg:gap-4">
          <Link
            href="/admin/pay"
            className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-brand-green text-lg font-bold text-white shadow-sm active:opacity-90"
          >
            <HandCoins className="size-7" /> জমা নিন
          </Link>
          <Link
            href="/admin/transactions/new"
            className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-brand-navy bg-white text-base font-semibold text-brand-navy active:bg-muted"
          >
            <Plus className="size-7" /> আয়/ব্যয় যোগ
          </Link>
          <Link
            href="/admin/pay/bulk"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-white text-base font-medium text-brand-navy active:bg-muted lg:h-20 lg:flex-col lg:gap-1 lg:text-base lg:font-semibold"
          >
            <Users className="size-5" /> একসাথে জমা
          </Link>
          <Link
            href="/admin/members/new"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-white text-base font-medium text-brand-navy active:bg-muted lg:h-20 lg:flex-col lg:gap-1 lg:text-base lg:font-semibold"
          >
            <UserPlus className="size-5" /> নতুন সদস্য
          </Link>
        </div>
      ) : null}

      {adminUi && pendingReportCount > 0 ? (
        <Link
          href="/admin/reports"
          className="flex items-center gap-3 rounded-2xl border-2 border-[#e2136e] bg-pink-50 p-4 text-[#8f0c46] lg:col-span-2"
        >
          <Smartphone className="size-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm">বিকাশ/নগদের জানানো জমা</span>
            <span className="block text-lg font-bold">{toBn(pendingReportCount)}টি যাচাই বাকি</span>
          </span>
          <ChevronRight className="size-5" />
        </Link>
      ) : null}

      {/* This month's collection — visible to everyone (transparency); cash-handling extras for admins. */}
      {monthLines.length ? (
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">{monthLabel(thisMonth)}-এর চাঁদা</h2>
            <span className="text-sm text-muted-foreground">
              {toBn(paidCount)}/{toBn(active.length)} জন দিয়েছেন
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-brand-green" style={{ width: `${monthExpected ? Math.min(100, (monthPaid * 100) / monthExpected) : 0}%` }} />
          </div>
          <p className="text-base">
            আদায় <b>{taka(monthPaid)}</b> / {taka(monthExpected)}
          </p>
          {adminUi ? (
          <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-sm text-muted-foreground">আজ জমা ({toBn(todays.length)}টি)</p>
              <p className="text-xl font-bold">{taka(todayTotal)}</p>
            </div>
            <Link href="/admin/dues" className="rounded-xl bg-red-50 p-3 active:bg-red-100">
              <p className="text-sm text-red-800">টাকা বাকি</p>
              <p className="flex items-center justify-between text-xl font-bold text-red-800">
                {toBn(pendingCount)} জন <ChevronRight className="size-5" />
              </p>
              <p className="text-xs text-red-800/80">মেয়াদ পেরিয়েছে {toBn(owingCount)} জন</p>
            </Link>
          </div>
          <a
            href={waLink(null, groupMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white active:opacity-90"
          >
            <MessageCircle className="size-5" /> মাসিক হিসাব WhatsApp গ্রুপে পাঠান
          </a>
          </>
          ) : (
            <Link href="/grid" className="flex h-11 items-center justify-center gap-1 rounded-xl bg-secondary text-base text-brand-navy">
              {pendingCount > 0 ? `টাকা বাকি আছে ${toBn(pendingCount)} জনের` : "সবার চাঁদা জমা হয়েছে"} — গ্রিডে দেখুন <ChevronRight className="size-5" />
            </Link>
          )}
        </section>
      ) : null}

      {pendingVotes.map((p) => (
        <Link
          key={p.id}
          href={`/proposals/${p.id}`}
          className="flex items-center gap-3 rounded-2xl border-2 border-blue-600 bg-blue-50 p-4 text-blue-900 lg:col-span-2"
        >
          <Vote className="size-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{me ? "আপনার ভোট দরকার" : "ভোট চলছে"}</span>
            <span className="block truncate text-base font-semibold">{p.title}</span>
          </span>
          <ChevronRight className="size-5" />
        </Link>
      ))}

      {entry ? (
      <section className="space-y-2">
        <div
          className={cn(
            "rounded-2xl p-4 text-white",
            entry.due > 0 ? "bg-destructive" : "bg-brand-navy",
          )}
        >
          <p className="text-sm text-white/80">আমার বকেয়া</p>
          <p className="text-3xl font-bold">{taka(entry.due)}</p>
          <p className="mt-1 text-sm text-white/85">
            {entry.due > 0
              ? `প্রতি মাসের ${toBn(snap.settings.dueDay)} তারিখের মধ্যে চাঁদা দিন।`
              : entry.currentOpen > 0
                ? "পুরনো কোনো বকেয়া নেই। তবে এই মাসের চাঁদা এখনো জমা হয়নি।"
                : "আপনার কোনো বকেয়া নেই। ধন্যবাদ!"}
          </p>
        </div>
        {reminder ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-amber-950">
            <CalendarClock className="size-7 shrink-0" />
            <p className="text-base leading-snug">
              {monthLabel(reminder.month)}-এর চাঁদা <b>{taka(reminder.remaining)}</b> — {formatDate(reminder.dueDate)}-এর মধ্যে দিন।{" "}
              <b>{reminder.daysLeft === 0 ? "আজই শেষ দিন!" : `আর ${toBn(reminder.daysLeft)} দিন বাকি।`}</b>
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="আমার শেয়ার" value={`${toBn(entry.sharesNow)} টি`} />
          <StatCard label="আমার মোট জমা" value={taka(entry.paid)} tone="good" />
        </div>
        {current ? (
          <div className="flex items-center justify-between rounded-xl border bg-white p-3">
            <div>
              <p className="text-sm text-muted-foreground">এই মাস ({monthLabel(thisMonth)})</p>
              <p className="text-base">
                {taka(current.paid)} / {taka(current.expected)}
              </p>
            </div>
            <span className={cn("rounded-md px-3 py-1 text-sm", STATUS_CLASS[current.status])}>{STATUS_LABEL[current.status]}</span>
          </div>
        ) : null}
        <Link
          href="/report"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#e2136e] bg-white px-3 text-base font-medium text-[#b10f57] active:bg-pink-50"
        >
          <Smartphone className="size-5" /> বিকাশ/নগদে দিয়েছি? এখানে জানান
        </Link>
        <Link href="/me" className="flex h-11 items-center justify-center gap-1 text-base text-brand-navy">
          আমার পুরো হিসাব দেখুন <ChevronRight className="size-5" />
        </Link>
      </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-semibold text-brand-navy">সমিতির তহবিল</h2>
        <p className="text-3xl font-bold">{taka(fund.total)}</p>
        <div>
          <div className="flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`নগদ ${toBn(fund.cashPct)}%, বিনিয়োগ ${toBn(investedPct)}%`}>
            <div className="bg-brand-green" style={{ width: `${fund.total > 0 ? fund.cashPct : 0}%` }} />
            <div className="bg-brand-navy" style={{ width: `${investedPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span>
              <span className="mr-1 inline-block size-3 rounded-sm bg-brand-green align-middle" />
              নগদ {taka(fund.cash)} ({toBn(fund.cashPct)}%)
            </span>
            <span>
              <span className="mr-1 inline-block size-3 rounded-sm bg-brand-navy align-middle" />
              বিনিয়োগ {taka(fund.invested)}
            </span>
          </div>
        </div>
        {fund.cashBelowMinimum ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            নগদ তহবিল {toBn(fund.minCashPct)}%-এর নিচে নেমে গেছে। নিয়ম অনুযায়ী কমপক্ষে {toBn(fund.minCashPct)}% নগদ রাখতে হবে।
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">মোট চাঁদা জমা</dt>
          <dd className="text-right">{taka(fund.totalDues)}</dd>
          <dt className="text-muted-foreground">আয়</dt>
          <dd className="text-right">{taka(fund.income)}</dd>
          <dt className="text-muted-foreground">খরচ ও অন্যান্য</dt>
          <dd className="text-right">{taka(fund.byType.expense + fund.byType.member_refund + fund.byType.dividend)}</dd>
        </dl>
        <Link href="/transactions" className="flex h-10 items-center justify-center gap-1 text-base text-brand-navy">
          আয়-ব্যয় দেখুন <ChevronRight className="size-5" />
        </Link>
      </section>

      {notices.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">নোটিশ</h2>
            <Link href="/notices" className="text-base text-brand-navy">
              সব নোটিশ
            </Link>
          </div>
          {notices.map((n) => (
            <article key={n.id} className="rounded-xl border-l-4 border-brand-green bg-white p-3">
              <p className="text-base font-semibold">{n.title}</p>
              <p className="mt-1 text-base whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}
