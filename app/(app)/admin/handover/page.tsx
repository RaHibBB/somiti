import { desc } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot, loadTransactions } from "@/lib/data"
import { getDb } from "@/lib/db"
import { cashHandovers } from "@/lib/db/schema"
import { formatDate, taka, toBn } from "@/lib/format"
import { holderBalances } from "@/lib/holdings"
import { cn } from "@/lib/utils"
import { VoidButton } from "../void/void-button"
import { HandoverForm } from "./handover-form"

export const metadata = { title: "টাকা হস্তান্তর — সমিতি" }

export default async function HandoverPage({ searchParams }: PageProps<"/admin/handover">) {
  const me = await requireAdmin()
  const q = await searchParams
  const preFrom = typeof q.from === "string" ? Number(q.from) : undefined
  const preAmount = typeof q.amount === "string" && /^\d+$/.test(q.amount) ? q.amount : undefined
  const snap = await getSnapshot()
  const [all, txns] = await Promise.all([getDb().select().from(cashHandovers).orderBy(desc(cashHandovers.id)), loadTransactions()])
  const names = new Map(snap.members.map((m) => [m.member.id, m.member.nameBn]))
  const { holders, bankTotal } = holderBalances(
    snap.members.flatMap((m) => m.payments),
    all,
    txns,
  )
  const balanceOf = (id: number) => holders.find((h) => h.id === id)?.balance ?? 0
  const admins = snap.members
    .filter((m) => m.member.status === "active" && m.member.role === "admin")
    .map((m) => ({ id: m.member.id, name: m.member.nameBn, balance: balanceOf(m.member.id) }))

  return (
    <div className="space-y-4">
      <PageTitle>ব্যাংকে জমা / হস্তান্তর</PageTitle>
      <p className="text-base text-muted-foreground">
        কোনো অ্যাডমিন ব্যাংকে টাকা জমা দিলে বা অন্য অ্যাডমিনকে টাকা দিলে এখানে লিখুন। তাহলে &quot;কার হাতে কত টাকা আছে&quot; সবসময় ঠিক থাকবে।
      </p>

      <div className="rounded-xl bg-secondary p-3">
        <p className="text-sm text-muted-foreground">এখন কার হাতে কত (আদায় − দেওয়া + পাওয়া)</p>
        <ul className="mt-1 divide-y">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1.5 text-base">
              <span>{a.name}</span>
              <b className={cn(a.balance < 0 && "text-destructive")}>{taka(a.balance)}</b>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-sm text-muted-foreground">ব্যাংকে জমা হয়েছে মোট {taka(bankTotal)}</p>
      </div>

      <HandoverForm admins={admins} meId={admins.some((a) => a.id === preFrom) ? (preFrom as number) : me.id} today={snap.today} initialAmount={preAmount} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">সব হস্তান্তর ({toBn(all.length)})</h2>
        {all.length === 0 ? <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কিছু লেখা হয়নি</p> : null}
        <ul className="space-y-2">
          {all.map((h) => {
            const isVoid = h.status === "void"
            const label = `${names.get(h.fromId) ?? "?"} → ${h.toId ? (names.get(h.toId) ?? "?") : "ব্যাংক"} · ${taka(h.amount)}`
            return (
              <li key={h.id} className={cn("rounded-xl border bg-white p-3", isVoid && "bg-muted/60")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-base font-medium", isVoid && "line-through")}>
                    {names.get(h.fromId) ?? "?"} → {h.toId ? (names.get(h.toId) ?? "?") : "ব্যাংক"}
                  </span>
                  <span className={cn("text-lg font-bold", isVoid && "text-muted-foreground line-through")}>{taka(h.amount)}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(h.date)}
                  {h.note ? ` · ${h.note}` : ""}
                </p>
                {isVoid ? <p className="text-sm font-medium text-destructive">বাতিল — {h.voidReason}</p> : null}
                {!isVoid ? (
                  <div className="mt-1 flex justify-end">
                    <VoidButton kind="handover" id={h.id} label={label} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
