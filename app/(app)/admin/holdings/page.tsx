import Link from "next/link"
import { asc } from "drizzle-orm"
import { Check, Landmark, Pencil } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot, loadTransactions } from "@/lib/data"
import { getDb } from "@/lib/db"
import { cashHandovers } from "@/lib/db/schema"
import { monthHoldings } from "@/lib/holdings"
import { formatDate, monthLabel, taka, toBn } from "@/lib/format"
import { addMonths, monthOf } from "@/lib/ledger"
import { cn } from "@/lib/utils"
import { VoidButton } from "../void/void-button"

export const metadata = { title: "কার কাছে কত টাকা — সমিতি" }

/**
 * One month at a time: what each admin carried in, collected, deposited in the bank, and still holds.
 * The goal every month is simple — everyone's "হাতে আছে" ends at ৳০ once the money is in the bank.
 */
export default async function HoldingsPage({ searchParams }: PageProps<"/admin/holdings">) {
  await requireAdmin()
  const snap = await getSnapshot()
  const [handovers, txns] = await Promise.all([getDb().select().from(cashHandovers).orderBy(asc(cashHandovers.id)), loadTransactions()])
  const names = new Map(snap.members.map((m) => [m.member.id, m.member.nameBn]))
  const name = (id: number) => names.get(id) ?? "অজানা"

  const current = monthOf(snap.today)
  const first = snap.settings.startMonth
  const raw = (await searchParams).month
  const month = typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw) && `${raw}-01` >= first && `${raw}-01` <= current ? `${raw}-01` : current
  const label = monthLabel(month)

  const h = monthHoldings(
    snap.members.flatMap((m) => m.payments),
    handovers,
    month,
    txns,
  )
  const allInBank = h.collected > 0 && h.inHand === 0 && h.unknownAmount === 0
  const monthHandovers = handovers.filter((t) => t.date.slice(0, 7) === month.slice(0, 7)).reverse()

  const months: string[] = []
  for (let m = current; m >= first && months.length < 12; m = addMonths(m, -1)) months.push(m)
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", on ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white")

  return (
    <div className="space-y-4">
      <PageTitle>কার কাছে কত টাকা</PageTitle>
      {months.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {months.map((m) => (
            <Link key={m} href={`/admin/holdings?month=${m.slice(0, 7)}`} className={chip(m === month)}>
              {monthLabel(m)}
            </Link>
          ))}
        </div>
      ) : null}

      {/* The month at a glance */}
      <div className={cn("rounded-2xl p-4", allInBank ? "bg-green-50 text-green-900" : "bg-secondary")}>
        <p className="text-sm">{label}</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">আদায়</p>
            <p className="text-lg font-bold">{taka(h.collected)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ব্যাংকে জমা</p>
            <p className="text-lg font-bold">{taka(h.toBank)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">হাতে আছে</p>
            <p className={cn("text-lg font-bold", h.inHand > 0 && "text-amber-700")}>{taka(h.inHand)}</p>
          </div>
        </div>
        {allInBank ? (
          <p className="mt-2 flex items-center justify-center gap-1 text-base font-semibold">
            <Check className="size-5" /> এ মাসের সব টাকা ব্যাংকে জমা হয়েছে
          </p>
        ) : null}
        <p className="mt-2 text-center text-sm">
          ব্যাংকে আছে: <b>{taka(h.bankBalance)}</b>
          <span className="text-xs text-muted-foreground"> (মোট জমা {taka(h.bankTotal)}, ব্যাংক থেকে খরচ/বিনিয়োগ বাদ দিয়ে)</span>
        </p>
      </div>

      {h.unknownAmount > 0 ? (
        <Link href="/admin/holdings/fix" className="flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          <Pencil className="size-5 shrink-0" />
          <span>
            এ মাসের {taka(h.unknownAmount)} জমায় লেখা নেই টাকা কার কাছে। <b>চাপুন ঠিক করতে →</b>
          </span>
        </Link>
      ) : null}

      {/* Per admin */}
      <ul className="space-y-2">
        {h.holders.map((r) => (
          <li key={r.id} className="rounded-2xl border bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-semibold">{name(r.id)}</p>
              <p className={cn("text-xl font-bold", r.closing > 0 ? "text-amber-700" : r.closing < 0 ? "text-destructive" : "text-green-700")}>
                হাতে {taka(r.closing)}
              </p>
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {r.opening ? (
                <>
                  <dt>আগের মাস থেকে</dt>
                  <dd className="text-right">{taka(r.opening)}</dd>
                </>
              ) : null}
              <dt>এ মাসে আদায়</dt>
              <dd className="text-right">{taka(r.collected)}</dd>
              <dt>ব্যাংকে জমা</dt>
              <dd className="text-right">{taka(r.toBank)}</dd>
              {r.givenOut ? (
                <>
                  <dt>অন্য অ্যাডমিনকে দিয়েছেন</dt>
                  <dd className="text-right">{taka(r.givenOut)}</dd>
                </>
              ) : null}
              {r.receivedIn ? (
                <>
                  <dt>অন্য অ্যাডমিন থেকে পেয়েছেন</dt>
                  <dd className="text-right">{taka(r.receivedIn)}</dd>
                </>
              ) : null}
              {r.spentCash ? (
                <>
                  <dt>হাতের নগদ থেকে খরচ</dt>
                  <dd className="text-right">{taka(r.spentCash)}</dd>
                </>
              ) : null}
              {r.incomeCash ? (
                <>
                  <dt>নগদে আয় পেয়েছেন</dt>
                  <dd className="text-right">{taka(r.incomeCash)}</dd>
                </>
              ) : null}
            </dl>
            {r.closing > 0 ? (
              <Link
                href={`/admin/handover?from=${r.id}&amount=${r.closing}`}
                className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy text-base font-semibold text-white"
              >
                <Landmark className="size-5" /> {taka(r.closing)} ব্যাংকে জমা দিয়েছি
              </Link>
            ) : null}
          </li>
        ))}
        {h.holders.length === 0 && h.unknownAmount === 0 ? (
          <li className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এ মাসে এখনো কোনো টাকা আদায় হয়নি</li>
        ) : null}
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/admin/handover" className="flex h-11 items-center justify-center rounded-lg border bg-white text-base active:bg-muted">
          ব্যাংকে জমা / হস্তান্তর লিখুন
        </Link>
        <Link href="/admin/holdings/fix" className="flex h-11 items-center justify-center rounded-lg border bg-white text-base active:bg-muted">
          কোন জমা কার কাছে — সংশোধন
        </Link>
      </div>

      {monthHandovers.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">{label}-এ ব্যাংকে জমা ও হস্তান্তর ({toBn(monthHandovers.length)})</h2>
          <ul className="space-y-2">
            {monthHandovers.map((t) => {
              const isVoid = t.status === "void"
              return (
                <li key={t.id} className={cn("rounded-xl border bg-white p-3", isVoid && "bg-muted/60")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-base", isVoid && "line-through")}>
                      {name(t.fromId)} → {t.toId ? name(t.toId) : "ব্যাংক"}
                    </span>
                    <b className={cn("text-lg", isVoid && "text-muted-foreground line-through")}>{taka(t.amount)}</b>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(t.date)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                  {isVoid ? <p className="text-sm text-destructive">বাতিল — {t.voidReason}</p> : null}
                  {!isVoid ? (
                    <div className="mt-1 flex justify-end">
                      <VoidButton kind="handover" id={t.id} label={`${name(t.fromId)} → ${t.toId ? name(t.toId) : "ব্যাংক"} · ${taka(t.amount)}`} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
