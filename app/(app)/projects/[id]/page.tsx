import Link from "@/components/link"
import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { FileDown, ImageIcon, Minus, Plus, ShoppingCart } from "lucide-react"
import { GroupShare } from "@/components/group-share"
import { PageTitle } from "@/components/layout/page-title"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { appUrl } from "@/lib/app-url"
import { getSnapshot, loadProjects } from "@/lib/data"
import { getDb } from "@/lib/db"
import { projectEvents, proposals } from "@/lib/db/schema"
import { formatDate, formatDateTime, monthLabel, taka, toBn } from "@/lib/format"
import { getGroupUrl } from "@/lib/group"
import { monthDiff, monthOf } from "@/lib/ledger"
import { samitiYear } from "@/lib/profit"
import { categoryBreakdown, KIND_LABELS, TYPE_TO_KIND } from "@/lib/projects"
import { projectMessage } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import { VoidButton } from "../../admin/void/void-button"
import { ProjectControls } from "./project-controls"

export async function generateMetadata({ params }: PageProps<"/projects/[id]">) {
  const id = Number((await params).id)
  const p = (await loadProjects()).find((x) => x.id === id)
  return { title: p ? `${p.name} — প্রকল্প` : "প্রকল্প — সমিতি" }
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const db = getDb()
  const [list, snap, events] = await Promise.all([
    loadProjects(db),
    getSnapshot(),
    db.select().from(projectEvents).where(eq(projectEvents.projectId, id)).orderBy(asc(projectEvents.id)),
  ])
  const p = list.find((x) => x.id === id)
  if (!p) notFound()
  const [proposal] = p.proposalId ? await db.select({ id: proposals.id, title: proposals.title }).from(proposals).where(eq(proposals.id, p.proposalId)) : []
  const names = new Map(snap.members.map((m) => [m.member.id, m.member.nameBn]))
  const t = p.totals
  const breakdown = categoryBreakdown(p.entries)
  const valid = p.entries.filter((e) => e.status === "valid")
  const lastEntry = valid.reduce((m, e) => (e.date > m ? e.date : m), p.startedOn)
  const lastEvent = events.at(-1)
  const year = p.closedOn ? samitiYear(snap.settings.startMonth, Math.max(0, Math.floor(monthDiff(snap.settings.startMonth, monthOf(p.closedOn)) / 12))) : null
  const overBudget = p.budget !== null && t.spent > p.budget
  const base = await appUrl()

  const message = projectMessage({
    name: p.name,
    closed: p.closed,
    closedOn: p.closedOn,
    startedOn: p.startedOn,
    totals: t,
    breakdown,
    url: `${base}/projects/${p.id}`,
  })

  const addLink = (kind: "capital" | "cost" | "income") => `/admin/transactions/new?project=${p.id}&kind=${kind}`

  return (
    <div className="space-y-4">
      <PageTitle>{p.name}</PageTitle>

      <div className={cn("rounded-2xl p-4", p.closed ? "bg-green-50 text-green-950" : "bg-secondary")}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            {p.closed && p.closedOn ? `${formatDate(p.startedOn)} – ${formatDate(p.closedOn)}` : `শুরু ${formatDate(p.startedOn)}`}
          </p>
          <span className={cn("rounded-md px-2 py-0.5 text-sm font-semibold", p.closed ? "bg-green-600 text-white" : "bg-amber-100 text-amber-900")}>
            {p.closed ? "শেষ" : "চলছে"}
          </span>
        </div>
        <p className={cn("mt-1 text-2xl font-bold", p.closed && t.result > 0 && "text-green-700", p.closed && t.result < 0 && "text-destructive")}>
          {p.closed
            ? t.result < 0
              ? `ক্ষতি ${taka(-t.result)}`
              : `লাভ ${taka(t.result)}`
            : t.income > 0 && t.tied === 0
              ? `এখন পর্যন্ত লাভ ${taka(t.result)}`
              : `বিনিয়োগে আছে ${taka(t.tied)}`}
        </p>
        {p.closed && year ? (
          <p className="text-sm">
            এই {t.result < 0 ? "ক্ষতি" : "লাভ"} {monthLabel(year.periodStart)} – {monthLabel(year.periodEnd)} বছরের মুনাফা বণ্টনে যোগ হবে।
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">প্রকল্প শেষ হলে (যেমন গরু বিক্রি) লাভ-ক্ষতি হিসাব হবে।</p>
        )}
        {proposal ? (
          <p className="mt-1 text-sm">
            ভোটে পাস:{" "}
            <Link href={`/proposals/${proposal.id}`} className="underline">
              প্রস্তাব #{toBn(proposal.id)} {proposal.title}
            </Link>
          </p>
        ) : null}
        {p.description ? <p className="mt-1 text-sm whitespace-pre-line">{p.description}</p> : null}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-3">
          <dt className="text-sm text-muted-foreground">কেনা / মূলধন</dt>
          <dd className="text-xl font-bold">{taka(t.capital)}</dd>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <dt className="text-sm text-muted-foreground">খরচ</dt>
          <dd className="text-xl font-bold">{taka(t.costs)}</dd>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <dt className="text-sm text-muted-foreground">মোট খরচ</dt>
          <dd className="text-xl font-bold">{taka(t.spent)}</dd>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <dt className="text-sm text-muted-foreground">আয় / বিক্রি</dt>
          <dd className="text-xl font-bold text-green-700">{taka(t.income)}</dd>
        </div>
      </dl>

      {p.budget !== null ? (
        <div className="space-y-1 rounded-xl border bg-white p-3">
          <p className="flex justify-between text-sm">
            <span>বাজেট {taka(p.budget)}</span>
            <span className={overBudget ? "font-semibold text-destructive" : "text-muted-foreground"}>
              {overBudget ? `বাজেটের চেয়ে ${taka(t.spent - p.budget)} বেশি` : `বাকি ${taka(p.budget - t.spent)}`}
            </span>
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`বাজেটের ${toBn(Math.min(100, Math.round((t.spent * 100) / p.budget)))}% খরচ`}>
            <div className={cn("h-full", overBudget ? "bg-destructive" : "bg-brand-navy")} style={{ width: `${Math.min(100, (t.spent * 100) / p.budget)}%` }} />
          </div>
        </div>
      ) : null}

      {adminUi && !p.closed ? (
        <div className="grid grid-cols-3 gap-2">
          <Link href={addLink("cost")} className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-brand-navy px-1 text-center text-sm font-semibold text-white">
            <Minus className="size-5" /> খরচ লিখুন
          </Link>
          <Link href={addLink("income")} className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-green-700 px-1 text-center text-sm font-semibold text-white">
            <Plus className="size-5" /> আয় / বিক্রি
          </Link>
          <Link href={addLink("capital")} className="flex min-h-14 flex-col items-center justify-center rounded-xl border-2 border-brand-navy bg-white px-1 text-center text-sm font-semibold text-brand-navy">
            <ShoppingCart className="size-5" /> কেনা / মূলধন
          </Link>
        </div>
      ) : null}

      {breakdown.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">খাতওয়ারি হিসাব</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {breakdown.map((b) => (
              <li key={`${b.kind}-${b.category}`} className="flex items-center justify-between px-3 py-2">
                <span>
                  {b.category} <span className="text-xs text-muted-foreground">· {KIND_LABELS[b.kind]}</span>
                </span>
                <b className={b.kind === "income" ? "text-green-700" : undefined}>
                  {b.kind === "income" ? "+" : "−"}
                  {taka(b.amount)}
                </b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href={`/print/project/${p.id}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-navy bg-white text-base font-semibold text-brand-navy">
          <FileDown className="size-5" /> PDF ডাউনলোড
        </Link>
        {adminUi ? <GroupShare text={message} groupUrl={getGroupUrl()} label="প্রকল্পের হিসাব গ্রুপে পাঠান" /> : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">সব এন্ট্রি ({toBn(p.entries.length)})</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {p.entries.map((e) => {
            const isVoid = e.status === "void"
            const kind = TYPE_TO_KIND[e.type]
            const inflow = kind === "income"
            return (
              <li key={e.id} className={cn("flex gap-3 px-3 py-3", isVoid && "bg-muted/60")}>
                {e.receiptUrl ? (
                  <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.receiptUrl} alt="রসিদ" loading="lazy" className="size-14 rounded-lg border object-cover" />
                  </a>
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      {e.category ?? (kind ? KIND_LABELS[kind] : "")} · {formatDate(e.date)}
                    </span>
                    <span className={cn("shrink-0 text-base font-semibold", isVoid ? "text-muted-foreground line-through" : inflow ? "text-green-700" : "")}>
                      {inflow ? "+" : "−"}
                      {taka(e.amount)}
                    </span>
                  </div>
                  <p className={cn("text-base", isVoid && "line-through")}>{e.description}</p>
                  {adminUi ? (
                    <p className="text-xs text-muted-foreground">
                      {e.via === "cash" ? `${names.get(e.cashHolderId ?? 0) ?? "অ্যাডমিন"}-এর হাতের নগদ` : "ব্যাংক"}
                      {e.createdBy ? ` · লিখেছেন: ${names.get(e.createdBy) ?? "—"}` : ""}
                    </p>
                  ) : null}
                  {isVoid ? <p className="text-sm font-medium text-destructive">বাতিল — {e.voidReason}</p> : null}
                  {adminUi && !isVoid && !p.closed ? (
                    <div className="mt-1 flex justify-end">
                      <VoidButton kind="transaction" id={e.id} label={`${e.category ?? e.description} · ${taka(e.amount)}`} />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
          {p.entries.length === 0 ? (
            <li className="px-3 py-4 text-center text-muted-foreground">
              এখনো কোনো এন্ট্রি নেই।{adminUi ? " ওপরের \"কেনা / মূলধন\" দিয়ে শুরু করুন।" : ""}
            </li>
          ) : null}
        </ul>
      </section>

      {adminUi ? (
        <section className="space-y-2">
          <ProjectControls id={p.id} name={p.name} closed={p.closed} today={snap.today} minDate={lastEntry} result={t.result} />
          {lastEvent ? (
            <p className="text-xs text-muted-foreground">
              {lastEvent.kind === "close" ? "শেষ করেছেন" : "আবার খুলেছেন"}: {names.get(lastEvent.byId) ?? "অ্যাডমিন"} · {formatDateTime(lastEvent.createdAt)}
              {lastEvent.reason ? ` · ${lastEvent.reason}` : ""}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
